// =====================================================================
// === SCREENS: OP NOVA (Seam C) ========================================
// Tela principal de Nova OP / edição de OP existente. Foi a última
// função grande inline do <script> de index.html. Extraída como módulo
// clássico (sem ES module) preservando:
//
//   - a closure inteira (estado local + ~20 subfunções);
//   - a assinatura async function screenNovaOP(opId);
//   - os call-sites já modularizados
//     (window.persistirOP, window.aplicarRecalculoOP,
//      window.maxMetrosItem, window.itensValidosOP,
//      window.registrarRecebimentoOrdemFio,
//      window.atribuirFornecedorFioOp, window.renderOPLatexAdmin,
//      window.renderOPTecelagemProducaoAdmin,
//      window.rotuloModelo, window.fmtKg, window.fmtMetros,
//      window.disabledAttr, window.rotuloFio, window.OCF_STATUS_LABEL);
//   - os helpers de UI vindos de js/ui.js e js/badges.js
//     (el, toast, textInput, selectInput, modal, confirmDialog,
//      shellLayout, ADMIN_MENU);
//   - os helpers puros vindos de js/calculo-op.js
//     (larguraKey, calcularFiosOP, recalcularOP, consumoPorOrdem,
//      totalEntregueCimaPorItem, agruparOrdensCompraFio);
//   - o cliente Supabase via window.supa (apenas reads);
//   - a geração de PDF delegada para window.gerarPdfCompraFios
//     (extraído para js/screens/op-pdf.js em OP-NOVA-PDF-MODULE-A).
//
// Fase: RAVATEX-TAPETES-ADMIN-NOVA-OP-MATCH-STANDALONE-A — redesign
//   visual completo do miolo desta tela para igualar ao HTML
//   standalone "Admin - Nova OP - standalone.html" (header com
//   subtítulo + Voltar, card "1. Dados da OP", card "2. Itens da OP",
//   card "3. Recebimento de fios" com pendentes/recebidas/proposta
//   por sliders, card "4. Entregas tecelagem", coluna lateral
//   "Resumo da OP" e barra inferior informativa), sem alterar o
//   shell/sidebar/topbar globais, rotas, validações, payloads,
//   writes ou queries de dados. A tabela de itens do standalone tem
//   colunas MODELO/METROS/QUANTIDADE/OBSERVAÇÃO/AÇÕES; como
//   `op_itens` não possui colunas de quantidade ou observação por
//   item (ver db/01_schema.sql), a tabela real usa apenas
//   MODELO/METROS/AÇÕES — diferença visual residual reportada,  sem
//   inventar campos ou alterar schema.
//
// Carregar via <script src="js/screens/op-nova.js"></script> no
// <head>, DEPOIS de js/screens/op-pdf.js e de
// js/screens/op-tecelagem-producao-admin.js, antes de
// js/boot.js. O call-site do inline em setRoutes
// (rota #/ops/nova) foi atualizado para window.screenNovaOP.
//
// O call-site dinâmico em js/router.js (rota #/ops/:id) já usava
// window.screenNovaOP desde a extração do router (ROUTER-MODULE-A).
//
// NÃO depende de nenhum estado de closure de outras telas.
// NÃO faz writes Supabase — todos os writes foram extraídos
// para op-persistir.js, op-recalculo.js e op-writes.js.
//
// Compatibilidade: window.screenNovaOP e
// window.RAVATEX_SCREENS.opNova.screenNovaOP seguem disponíveis
// para o call-site do inline em setRoutes.
// =====================================================================

(function (window) {
  'use strict';

  // -------------------------------------------------------------------
  // Ícones e tokens visuais extraídos do standalone (cores/paddings/
  // radius idênticos ao HTML de referência).
  // -------------------------------------------------------------------
  function svgEl(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild;
  }

  var SVG_BACK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  var SVG_CHEVRON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
  var SVG_CHEVRON_SM = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
  var SVG_PLUS = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  var SVG_TRASH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';
  var SVG_ICON_OP = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-accent-blue)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect><line x1="9" y1="12" x2="15" y2="12"></line><line x1="9" y1="16" x2="13" y2="16"></line></svg>';
  var SVG_ICON_GRID = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-accent-blue)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M3 15h18M9 3v18"></path></svg>';
  var SVG_ICON_LINES = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-accent-blue)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10H3M21 6H3M21 14H3M21 18H3"></path></svg>';
  var SVG_ICON_ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-accent-blue)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>';
  var SVG_ICON_SUMMARY = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--rv-accent-blue)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"></rect><path d="M8 7h8M8 11h8M8 15h5"></path></svg>';
  var SVG_EMPTY_BOX = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-tertiary)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 7V5a2 2 0 0 0-4 0v2"></path><path d="M8 7V5a2 2 0 0 1 4 0"></path></svg>';
  var SVG_PDF = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
  var SVG_WARNING = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--rv-signal-caution)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  var SVG_CHECK_SM = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--rv-signal-positive)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  var SVG_INFO = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--rv-accent-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  var SVG_INFO_BAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--rv-accent-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  var SVG_UNDO = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6M23 20v-6h-6"></path><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>';
  var SVG_SAVE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>';
  var SVG_OPEN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect></svg>';
  var SVG_HINT_LOCK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';

  var CARD = 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:var(--rv-radius);';
  var FIELD_LABEL = 'font-size:13px;font-weight:600;color:var(--rv-text-primary);margin-bottom:7px;display:block;';
  var INPUT_STYLE = 'width:100%;border:1px solid var(--rv-border-strong);border-radius:4px;padding:9px 12px;font-size:14px;font-family:inherit;color:var(--rv-text-primary);background:var(--rv-surface);outline:none;box-sizing:border-box;';
  var SELECT_STYLE = 'width:100%;border:1px solid var(--rv-border-strong);border-radius:4px;padding:9px 36px 9px 12px;font-size:14px;font-family:inherit;color:var(--rv-text-primary);background:var(--rv-surface);outline:none;appearance:none;-webkit-appearance:none;cursor:pointer;box-sizing:border-box;';
  var TH_STYLE = 'font-size:11px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.04em;white-space:nowrap;';
  var BTN_OUTLINE = 'display:inline-flex;align-items:center;gap:7px;background:var(--rv-surface);color:var(--rv-accent-blue);border:1.5px solid var(--rv-brand);border-radius:4px;padding:9px 16px;font-weight:600;font-size:14px;font-family:inherit;cursor:pointer;white-space:nowrap;';
  var BTN_PRIMARY = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;border-radius:4px;padding:12px 16px;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer;';
  var BTN_PRIMARY_DISABLED = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;border-radius:4px;padding:12px 16px;font-weight:700;font-size:15px;font-family:inherit;opacity:.45;cursor:default;';
  var BTN_SECONDARY = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;background:var(--rv-surface);color:var(--rv-accent-blue);border:1.5px solid var(--rv-brand);border-radius:4px;padding:10px 16px;font-weight:600;font-size:14px;font-family:inherit;cursor:pointer;';
  var BTN_BACK = 'display:inline-flex;align-items:center;gap:7px;background:var(--rv-surface);color:var(--rv-text-secondary);border:1px solid var(--rv-border-strong);border-radius:4px;padding:8px 16px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;';
  var BTN_SOLID_SM = 'display:inline-flex;align-items:center;background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;border-radius:4px;padding:8px 16px;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer;white-space:nowrap;';
  var BTN_LINK = 'display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--rv-accent-blue);background:none;border:none;padding:0;cursor:pointer;font-family:inherit;';
  var SECTION_ICON = 'width:34px;height:34px;border-radius:var(--rv-radius);background:var(--rv-pill-info-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;';
  var RV_CARD = 'background:var(--rv-color-surface);border:1px solid var(--rv-color-line-200);border-radius:var(--rv-radius-card);';
  var RV_TH_STYLE = 'font-size:var(--rv-font-size-label);font-weight:700;color:var(--rv-color-muted);letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;';
  var RV_FIELD_LABEL = 'display:block;font-size:11.5px;color:var(--rv-text-tertiary);margin-bottom:2px;';
  var RV_VALUE = 'font-size:13.5px;color:var(--rv-color-value);font-weight:600;line-height:1.35;';
  var RV_BTN_HDR_DANGER = 'display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border-radius:var(--rv-radius-control);font-size:13px;font-weight:500;color:var(--rv-color-danger);border:1px solid var(--rv-signal-negative-border);background:var(--rv-surface);cursor:pointer;font-family:inherit;white-space:nowrap;';
  var RV_BTN_PRIMARY = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;height:38px;background:var(--rv-color-accent);color:var(--rv-text-on-brand);border:none;border-radius:var(--rv-radius-control);padding:0 16px;font-weight:600;font-size:13.5px;font-family:inherit;white-space:nowrap;cursor:pointer;';
  // §2.1 (D9): mesmas cores do habilitado; o estado e opacidade + cursor.
  // Escrito com os tokens canonicos (--rv-color-accent e --rv-radius-control
  // sao aliases depreciados e resolvem para estes mesmos valores).
  var RV_BTN_PRIMARY_DISABLED = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;height:38px;background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;border-radius:var(--rv-radius);padding:0 16px;font-weight:600;font-size:13.5px;font-family:inherit;white-space:nowrap;opacity:.45;cursor:default;';
  var RV_BTN_DASHED = 'width:100%;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;border:1px dashed var(--rv-color-input-border);border-radius:var(--rv-radius-control);background:var(--rv-surface);color:var(--rv-text-secondary);font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;';

  var CHIP_STYLE = 'display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:var(--rv-radius-control);background:var(--rv-color-chip-bg);border:1px solid var(--rv-color-line-200);color:var(--rv-color-chip-glyph);flex-shrink:0;';
  var SECTION_LABEL_STYLE = 'font-size:var(--rv-font-size-label);font-weight:700;color:var(--rv-color-section-label);letter-spacing:var(--rv-tracking-label);text-transform:uppercase;';
  function chipSvg(inner) {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }
  var IC_DADOS = chipSvg('<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1"></rect>');
  var IC_ITENS = chipSvg('<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line>');
  var IC_FIOS = chipSvg('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4A2 2 0 0 0 13 22l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>');
  var IC_RESUMO = chipSvg('<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>');
  var IC_MOV = chipSvg('<line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>');
  var IC_DOC = chipSvg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>');
  var IC_CLIP = chipSvg('<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>');

  function chipLabel(label, iconMarkup) {
    return el('div', { style: 'display:flex;align-items:center;gap:9px;' },
      el('span', { style: CHIP_STYLE }, svgEl(iconMarkup || IC_DADOS)),
      el('span', { style: SECTION_LABEL_STYLE }, label));
  }

  function rvSectionPill(label, iconMarkup) {
    var node = chipLabel(label, iconMarkup);
    node.setAttribute('style', 'display:flex;align-items:center;gap:9px;margin-bottom:14px;');
    return node;
  }

  var PILL_BASE = 'display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:var(--rv-radius-pill);white-space:nowrap;';
  function rvDot(color) {
    return el('span', { style: 'width:6px;height:6px;border-radius:var(--rv-radius-pill);background:' + color + ';' });
  }
  function rvStageTecelagemBadge() {
    return el('span', { style: PILL_BASE + 'background:var(--rv-stage-tecelagem-bg);color:var(--rv-stage-tecelagem);' }, 'Tecelagem');
  }
  function rvStatusPrepBadge() {
    return el('span', { style: PILL_BASE + 'background:var(--rv-status-prep-bg);color:var(--rv-status-prep);' }, rvDot('var(--rv-status-prep)'), 'Preparacao');
  }

  // ORDEM-COMPRA-B1 reader — dimension-badge vocabulary. Reuses PILL_BASE
  // and the established status palette (existing --rv-status-*/--rv-stage-*
  // tokens + the green/red hexes already used elsewhere in this file), per
  // ORDEM_COMPRA_LIFECYCLE_SPEC §6 ("reuse the existing pill/badge tokens,
  // do not invent new visual language"). Read-only labels; no business rule.
  var OCF_SELECT_LEGACY = 'id, tipo, cor_id, cor_poliester, kg_pedido, kg_recebido, status, fornecedor_id, cores:cor_id(id, nome)';
  var OCF_SELECT_DIM = 'id, tipo, cor_id, cor_poliester, kg_pedido, kg_recebido, status, fornecedor_id, status_administrativo, status_aceite, status_recebimento, aceite_exigido_na_emissao, legado_recebimento_automatico, cores:cor_id(id, nome)';
  var OCF_ADMIN_LABEL = { rascunho: 'Rascunho', emitida: 'Emitida', cancelada: 'Cancelada' };
  var OCF_ACEITE_LABEL = { nao_aplicavel: 'Aceite dispensado', pendente: 'Aguardando aceite', aceita: 'Aceita', rejeitada: 'Rejeitada' };
  var OCF_RECEB_LABEL = { nao_recebido: 'Nao recebido', parcial: 'Recebimento parcial', recebido: 'Recebido' };
  function ocfPill(label, bg, fg, dot) {
    var kids = dot ? [rvDot(fg), label] : [label];
    return el('span', { style: PILL_BASE + 'background:' + bg + ';color:' + fg + ';' }, kids);
  }
  function ocfAdminBadge(v) {
    var map = {
      rascunho:  ['var(--rv-status-prep-bg)', 'var(--rv-status-prep)', true],
      emitida:   ['var(--rv-stage-tecelagem-bg)', 'var(--rv-stage-tecelagem)', false],
      cancelada: ['var(--rv-surface-subtle)', 'var(--rv-text-tertiary)', false],
    };
    var c = map[v] || ['var(--rv-surface-subtle)', 'var(--rv-text-tertiary)', false];
    return ocfPill(OCF_ADMIN_LABEL[v] || v, c[0], c[1], c[2]);
  }
  function ocfAceiteBadge(v) {
    var map = {
      nao_aplicavel: ['var(--rv-surface-subtle)', 'var(--rv-text-tertiary)', false],
      pendente:      ['var(--rv-status-prod-bg)', 'var(--rv-status-prod)', true],
      aceita:        ['var(--rv-signal-positive-bg)', 'var(--rv-signal-positive)', false],
      rejeitada:     ['var(--rv-surface)', 'var(--rv-signal-negative)', false],
    };
    var c = map[v] || ['var(--rv-surface-subtle)', 'var(--rv-text-tertiary)', false];
    return ocfPill(OCF_ACEITE_LABEL[v] || v, c[0], c[1], c[2]);
  }
  function ocfRecebBadge(v) {
    var map = {
      nao_recebido: ['var(--rv-surface-subtle)', 'var(--rv-text-tertiary)', false],
      parcial:      ['var(--rv-status-prod-bg)', 'var(--rv-status-prod)', true],
      recebido:     ['var(--rv-signal-positive-bg)', 'var(--rv-signal-positive)', false],
    };
    var c = map[v] || ['var(--rv-surface-subtle)', 'var(--rv-text-tertiary)', false];
    return ocfPill(OCF_RECEB_LABEL[v] || v, c[0], c[1], c[2]);
  }

  function sectionIcon(svgMarkup) {
    return el('div', { style: SECTION_ICON }, svgEl(svgMarkup));
  }
  function sectionHead(svgMarkup, title, extra) {
    var kids = [sectionIcon(svgMarkup), el('span', { style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);' }, title)];
    if (extra) kids.push(extra);
    return el('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:18px;' }, kids);
  }
  // PASS-7-A4: a <label> rendered as a SIBLING names nothing, and
  // role="combobox" — unlike a plain button — does not take its accessible
  // name from its own content. fieldBlock() is often handed `wrapSelect(ctrl)`
  // rather than the control itself, so the binding walks to the actual
  // descendant carrying the canonical marker. The wrapper never receives
  // combobox semantics.
  var opNovaLabelSeq = 0;
  function findSelectPopover(node) {
    if (!node || typeof node.getAttribute !== 'function') return null;
    if (node.getAttribute('data-rv-select-popover') === '1') return node;
    var kids = node.children || [];
    for (var i = 0; i < kids.length; i++) {
      var found = findSelectPopover(kids[i]);
      if (found) return found;
    }
    return null;
  }
  function bindSelectPopoverLabel(labelNode, node) {
    var control = findSelectPopover(node);
    if (!control) return;
    if (control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')) return;
    opNovaLabelSeq += 1;
    var id = 'rv-op-nova-field-label-' + opNovaLabelSeq;
    labelNode.setAttribute('id', id);
    control.setAttribute('aria-labelledby', id);
  }

  function fieldBlock(label, control, style) {
    var labelNode = el('label', { style: FIELD_LABEL }, label);
    bindSelectPopoverLabel(labelNode, control);
    return el('div', { style: style || '' }, labelNode, control);
  }
  function selectChevron(small) {
    return el('div', { style: 'position:absolute;right:' + (small ? '10px' : '12px') + ';top:50%;transform:translateY(-50%);pointer-events:none;' },
      svgEl(small ? SVG_CHEVRON_SM : SVG_CHEVRON));
  }
  function wrapSelect(selectNode, small) {
    return el('div', { style: 'position:relative;' }, selectNode, selectChevron(small));
  }
  // PASS-7-A4 (§10): SELECT_STYLE describes a NATIVE <select> — a fixed
  // padding box with `appearance:none` so the browser chevron disappears.
  // Applying it to the canonical select popover replaced the trigger's whole
  // inline style and broke the ratified Pass-7 geometry (41px instead of 32px,
  // 14px text, 9px vertical padding, inline-block instead of inline-flex).
  // js/select-popover.js is the SOLE owner of combobox geometry, so a
  // canonical trigger is returned untouched — before any class or style
  // mutation. Legacy non-popover controls keep the previous behaviour exactly.
  function styleSelect(sel, extra) {
    if (sel && typeof sel.getAttribute === 'function'
      && sel.getAttribute('data-rv-select-popover') === '1') return sel;
    sel.className = '';
    sel.setAttribute('style', SELECT_STYLE + (extra || ''));
    return sel;
  }
  function styleInput(input, extra) {
    input.className = '';
    input.setAttribute('style', INPUT_STYLE + (extra || ''));
    return input;
  }
  function thRow(colsTemplate, labels, options) {
    var alignLastRight = options && options.alignLast === 'right';
    // PASS-7-A4 §9: `firstCellId` lets the table give its FIRST column header
    // a stable id so a row-level combobox — which has no individual label —
    // can be named by the column it belongs to. No visible copy, no layout
    // and no style change; only an id attribute is added.
    var firstCellId = options && options.firstCellId;
    var cells = labels.map(function (l, i) {
      var attrs = { style: TH_STYLE + (alignLastRight && i === labels.length - 1 ? 'text-align:right;' : '') };
      if (i === 0 && firstCellId) attrs.id = firstCellId;
      return el('div', attrs, l);
    });
    return el('div', { style: 'display:grid;grid-template-columns:' + colsTemplate + ';gap:10px;padding:10px 24px;background:var(--rv-surface-subtle);border-bottom:1px solid var(--rv-border);' }, cells);
  }
  function gridRow(colsTemplate, cells) {
    return el('div', { style: 'display:grid;grid-template-columns:' + colsTemplate + ';gap:10px;padding:12px 24px;border-bottom:1px solid var(--rv-border-soft);align-items:center;' }, cells);
  }

  // PHASE-MANTA-A: explicit product-type chooser for a mixed Pedido. A weaving
  // OP is route-homogeneous; this picks which single type the new OP contains.
  // Resolves the chosen type ('tapete'|'manta'), or null if dismissed.
  function escolherTipoProdutoOP(tiposDisponiveis) {
    return new Promise(function (resolve) {
      var opcoes = tiposDisponiveis.map(function (t) { return { value: t, label: t === 'manta' ? 'Manta' : 'Tapete' }; });
      var sel = selectInput({ options: opcoes, value: tiposDisponiveis[0] });
      var escolhido = tiposDisponiveis[0];
      sel.onchange = function () { escolhido = sel.value; };
      var done = false;
      // PASS-7-A4: this modal owns its label directly, so it binds directly.
      // The hierarchy and copy are unchanged.
      var produtoLabel = el('label', { style: 'display:block;font-size:13px;font-weight:600;color:var(--rv-text-primary);margin-bottom:6px;' }, 'Produto desta OP');
      bindSelectPopoverLabel(produtoLabel, sel);
      modal({
        title: 'Tipo de produto desta OP',
        body: el('div', {},
          el('p', { style: 'font-size:13px;color:var(--rv-text-secondary);margin-bottom:12px;line-height:1.5;' },
            'Este Pedido tem itens de Tapete e Manta. Uma OP de tecelagem contém um único tipo de produto. Escolha qual esta OP vai conter; os itens do outro tipo permanecem disponíveis para outra OP.'),
          produtoLabel,
          sel
        ),
        saveLabel: 'Confirmar',
        onSave: function () { done = true; resolve(escolhido); },
        onClose: function () { if (!done) resolve(null); },
      });
    });
  }

  async function screenNovaOP(opId, pedidoId) {
  const container = el('div', {});
  // 1) Carrega dados de apoio
  const [modelosRes, paramsRes, fornsRes, clientesRes] = await Promise.all([
    supa.from('modelos').select('id, nome, largura, cor_1:cor_1_id(id,nome), cor_2:cor_2_id(id,nome)').order('nome'),
    supa.from('parametros_largura').select('*'),
    supa.from('fornecedores').select('id, nome, tipo').order('nome'),
    supa.from('clientes').select('id, nome').order('nome'),
  ]);
  if (modelosRes.error || paramsRes.error || fornsRes.error || clientesRes.error) {
    toast('Erro ao carregar dados da OP', 'error');
    console.error(modelosRes.error || paramsRes.error || fornsRes.error || clientesRes.error);
    return shellLayout(ADMIN_MENU, container);
  }
  const clientesOptions = (clientesRes.data || []).map(c => ({ value: c.id, label: c.nome }));
  const clientesById = Object.fromEntries((clientesRes.data || []).map(c => [String(c.id), c.nome]));
  const modelos = modelosRes.data || [];
  const modelosById = Object.fromEntries(modelos.map(m => [m.id, m]));
  // PHASE-MANTA-A: augment models with tipo_produto when the column exists
  // (graceful before the migration is applied; absent => treated as Tapete).
  const tipoProdutoRes = await supa.from('modelos').select('id, tipo_produto');
  if (!tipoProdutoRes.error && Array.isArray(tipoProdutoRes.data)) {
    for (const tr of tipoProdutoRes.data) {
      if (modelosById[tr.id]) modelosById[tr.id].tipo_produto = tr.tipo_produto;
    }
  }
  const parametrosByLargura = Object.fromEntries((paramsRes.data || []).map(p => [larguraKey(p.largura), p]));
  const forns = fornsRes.data || [];
  const fornsPorTipo = (tipo) => forns.filter(f => f.tipo === tipo).map(f => ({ value: f.id, label: f.nome }));

  function buildPedidoRequiredScreen() {
    return el('div', {},
      el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px;flex-wrap:wrap;' },
        el('div', {},
          el('div', { style: 'font-size:22px;font-weight:800;color:var(--rv-text-primary);letter-spacing:-.01em;' }, 'Nova OP'),
          el('div', { style: 'font-size:13.5px;color:var(--rv-text-tertiary);margin-top:4px;' }, 'Crie a OP a partir de um Pedido.')
        ),
        el('button', { type: 'button', style: BTN_BACK, onclick: () => navigate('#/pedidos') }, svgEl(SVG_BACK), 'Ir para Pedidos')
      ),
      el('div', { style: CARD + 'padding:22px 24px;max-width:760px;' },
        el('div', { style: 'display:flex;align-items:flex-start;gap:12px;' },
          svgEl(SVG_INFO),
          el('div', {},
            el('div', { style: 'font-size:var(--rv-fs-component-heading);font-weight:800;color:var(--rv-text-primary);margin-bottom:8px;' }, 'Nao e possivel abrir OP sem Pedido vinculado.'),
            el('div', { style: 'font-size:13.5px;color:var(--rv-text-secondary);line-height:1.55;margin-bottom:4px;' }, 'Acesse um Pedido e use Gerar primeira OP.'),
            el('div', { style: 'font-size:13px;color:var(--rv-text-tertiary);line-height:1.55;' }, 'Sem Pedido, a OP nao pode ser salva, aberta ou usada para movimentacao de material.')
          )
        )
      )
    );
  }

  if (!opId && !pedidoId) {
    container.replaceChildren(buildPedidoRequiredScreen());
    return shellLayout(ADMIN_MENU, container);
  }

  // 2) Estado da tela
  let op = null;                 // OP existente (modo edição/leitura)
  let itens = [];                // [{ modeloId, metros }]
  let fornSel = { fio_algodao: '', fio_poliester: '', cima: '' };
  let clienteSel = '';
  let opItensRaw = [];
  let ordens = [];
  // ORDEM-COMPRA-B1: is the db/65 dimension layer present on this database?
  // Set by fetchOrdensCompraFio's extended-select-with-fallback. When false
  // (pre-db/65 database, e.g. production before Phase A lands there), the
  // reader treats every row as legacy read-only and the OP screen never
  // regresses. See PROJECT_STATE ORDEM-COMPRA-B1-BLOCKED-BY-MCP-AUTH.
  let ordensDimDisponivel = false;
  let ocConfig = { exige_aceite: false };
  let entregasCima = [];
  let latexOpPorEntrega = {};
  let latexOpInfo = {};
  let opEventos = [];
  let saldoFiosOp = [];
  let cimaFornecedorId = null;
  let fioFornSel = { fio_algodao: '', fio_poliester: '' };
  let latexOptions = [];
  let numero = '', ano = new Date().getFullYear();
  let readOnly = false;
  let saving = false;
  let pedidoIdState = null;
  let pedidoCtx = null;
  let opSiblingOps = [];

  function humanizeLabel(value) {
    if (!value) return '—';
    return String(value).charAt(0).toUpperCase() + String(value).slice(1).replace(/_/g, ' ');
  }

  function fmtDateLabel(value) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleDateString('pt-BR');
    } catch (err) {
      return '';
    }
  }

  function pedidoDisplaySource() {
    if (!pedidoCtx) return null;
    return {
      id: pedidoCtx.id,
      numero: pedidoCtx.numero,
      criado_em: pedidoCtx.criadoEm || pedidoCtx.criado_em,
    };
  }

  function opDisplayContext() {
    return { pedido: pedidoDisplaySource(), ops: opSiblingOps };
  }

  function formatOpDisplay(opArg) {
    var api = window.RAVATEX_OP_DISPLAY;
    if (api && typeof api.formatOpOperationalCode === 'function') {
      return api.formatOpOperationalCode(opArg, opDisplayContext());
    }
    var numeroLabel = opArg && opArg.numero != null ? opArg.numero : (numero || '—');
    var anoLabel = opArg && opArg.ano != null ? opArg.ano : (ano || '—');
    return 'OP ' + numeroLabel + '/' + anoLabel;
  }

  async function loadPedidoSiblingOps(targetPedidoId) {
    if (!targetPedidoId || !supa || typeof supa.from !== 'function') return [];
    try {
      var lotesRes = await supa.from('lotes')
        .select('id')
        .eq('pedido_id', targetPedidoId);
      if (lotesRes.error) return [];
      var loteIds = (lotesRes.data || [])
        .map(function (lote) { return lote && lote.id; })
        .filter(function (id) { return id != null; });
      if (!loteIds.length) return [];
      var opsRes = await supa.from('ops')
        .select('id, numero, ano, status, tipo, criado_em, lote_id')
        .in('lote_id', loteIds)
        .order('criado_em', { ascending: true })
        .order('id', { ascending: true });
      return opsRes.error ? [] : (opsRes.data || []);
    } catch (err) {
      console.error('op-nova: erro ao carregar OPs irmas do pedido', err);
      return [];
    }
  }

  async function loadPedidoContext(targetPedidoId) {
    if (!targetPedidoId) return null;
    const pedRes = await supa.from('pedidos')
      .select('id, numero, status, criado_em, prazo_entrega, cliente_id, cliente:cliente_id(id, nome)')
      .eq('id', targetPedidoId)
      .maybeSingle();
    if (pedRes.error || !pedRes.data) return null;
    return {
      id: pedRes.data.id,
      numero: pedRes.data.numero,
      status: pedRes.data.status,
      criadoEm: pedRes.data.criado_em,
      prazoEntrega: pedRes.data.prazo_entrega,
      clienteId: pedRes.data.cliente_id,
      clienteNome: pedRes.data.cliente?.nome || '',
    };
  }

  function hasLinkedPedido() {
    return !!(pedidoCtx && pedidoCtx.id);
  }

  function isOpAbertaTecelagem() {
    return !!(op && op.status === 'aberta' && op.tipo !== 'latex');
  }

  function isOpEmProducaoTecelagem() {
    return !!(op && op.status === 'em_producao' && op.tipo !== 'latex');
  }

  function resolveClienteNome() {
    if (pedidoCtx && pedidoCtx.clienteNome) return pedidoCtx.clienteNome;
    if (op && op.lote && op.lote.cliente && op.lote.cliente.nome) return op.lote.cliente.nome;
    return clientesById[String(clienteSel)] || '—';
  }

  function buildPedidoMetaLine() {
    if (!hasLinkedPedido()) return '';
    const parts = [];
    if (pedidoCtx.status) parts.push('Status: ' + humanizeLabel(pedidoCtx.status));
    if (pedidoCtx.criadoEm) parts.push('Criado em ' + fmtDateLabel(pedidoCtx.criadoEm));
    if (pedidoCtx.prazoEntrega) parts.push('Prazo: ' + fmtDateLabel(pedidoCtx.prazoEntrega));
    return parts.join(' · ');
  }

  if (pedidoId) {
    pedidoCtx = await loadPedidoContext(pedidoId);
    if (!pedidoCtx) {
      toast('Pedido não encontrado', 'error');
      container.replaceChildren(el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:22px;' },
        el('div', { style: 'font-size:22px;font-weight:800;color:var(--rv-text-primary);letter-spacing:-.01em;' }, 'Pedido não encontrado'),
        el('button', { type: 'button', style: BTN_BACK, onclick: () => navigate('#/pedidos') }, svgEl(SVG_BACK), 'Voltar')));
      return shellLayout(ADMIN_MENU, container);
    }
    pedidoIdState = pedidoCtx.id;
    if (pedidoCtx.clienteId) clienteSel = pedidoCtx.clienteId;

    var pitensRes = await supa.from('pedido_itens')
      .select('id, modelo_id, metros, observacao')
      .eq('pedido_id', pedidoId)
      .order('ordem', { ascending: true });
    if (!pitensRes.error && pitensRes.data && pitensRes.data.length > 0) {
      for (var pi = 0; pi < pitensRes.data.length; pi++) {
        var pitem = pitensRes.data[pi];
        if (pitem.modelo_id && pitem.metros > 0) {
          itens.push({ modeloId: pitem.modelo_id, metros: pitem.metros, pedidoItemId: pitem.id });
        }
      }
    }

    // PHASE-MANTA-A: keep the new weaving OP route-homogeneous. A mixed Pedido
    // requires an explicit product-type choice and includes only that type;
    // the DB trigger and persistirOP guard remain the authority.
    var tiposPedidoOP = Array.from(new Set(itens.map(function (it) {
      var m = modelosById[it.modeloId];
      return (m && m.tipo_produto === 'manta') ? 'manta' : 'tapete';
    })));
    if (tiposPedidoOP.length > 1) {
      var tipoEscolhido = await escolherTipoProdutoOP(tiposPedidoOP);
      if (!tipoEscolhido) { navigate('#/pedidos'); return shellLayout(ADMIN_MENU, container); }
      itens = itens.filter(function (it) {
        var m = modelosById[it.modeloId];
        return ((m && m.tipo_produto === 'manta') ? 'manta' : 'tapete') === tipoEscolhido;
      });
    }
  }

  if (opId) {
    const { data, error } = await supa.from('ops')
      .select('id, numero, ano, status, tipo, observacao, origem_op_id, lote_id, criado_em, lote:lote_id(id, numero, pedido_id, cliente:cliente_id(id, nome)), op_itens(id, modelo_id, metros_pedidos, metros_ajustados, pedido_item_id), op_fornecedores(fornecedor_id, etapa)')
      .eq('id', opId).single();
    if (error || !data) {
      toast('OP não encontrada', 'error'); console.error(error);
      container.replaceChildren(el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:22px;' },
        el('div', { style: 'font-size:22px;font-weight:800;color:var(--rv-text-primary);letter-spacing:-.01em;' }, 'OP não encontrada'),
        el('button', { type: 'button', style: BTN_BACK, onclick: () => navigate('#/ops') }, svgEl(SVG_BACK), 'Voltar')));
      return shellLayout(ADMIN_MENU, container);
    }
    op = data;
    if (op.tipo === 'latex') return await window.renderOPLatexAdmin(op.id);
    pedidoIdState = op.lote?.pedido_id || pedidoIdState || null;
    if (pedidoIdState) {
      const pedidoExistente = await loadPedidoContext(pedidoIdState);
      if (pedidoExistente) pedidoCtx = pedidoExistente;
    }
    clienteSel = (pedidoCtx && pedidoCtx.clienteId) || op.lote?.cliente?.id || '';
    numero = data.numero; ano = data.ano;
    itens = (data.op_itens || []).map(i => ({ modeloId: i.modelo_id, metros: i.metros_pedidos, pedidoItemId: i.pedido_item_id || null }));
    for (const f of (data.op_fornecedores || [])) fornSel[f.etapa] = f.fornecedor_id;
    fioFornSel.fio_algodao = (data.op_fornecedores || []).find(f => f.etapa === 'fio_algodao')?.fornecedor_id || '';
    fioFornSel.fio_poliester = (data.op_fornecedores || []).find(f => f.etapa === 'fio_poliester')?.fornecedor_id || '';
    readOnly = data.status !== 'simulada';
    opItensRaw = data.op_itens || [];
    if (op.status !== 'simulada') {
      const ordRes = await fetchOrdensCompraFio(op.id);
      if (ordRes.error) { toast('Erro ao carregar ordens de fio', 'error'); console.error(ordRes.error); }
      ordens = ordRes.data || [];
      // ORDEM-COMPRA-B1: global config (Aceite dispensado/exigido chip).
      // Best-effort — absent table (pre-db/65) or error → default dispensado.
      const cfgRes = await supa.from('ordem_compra_config').select('exige_aceite').eq('id', 1).maybeSingle();
      ocConfig = { exige_aceite: !!(cfgRes && cfgRes.data && cfgRes.data.exige_aceite) };
      const cimaForn = (data.op_fornecedores || []).find(f => f.etapa === 'cima');
      cimaFornecedorId = cimaForn ? cimaForn.fornecedor_id : null;
      const latexResIni = await supa.from('fornecedores').select('id, nome').eq('tipo', 'latex').order('nome');
      if (latexResIni.error) { toast('Erro ao carregar empresas de látex', 'error'); console.error(latexResIni.error); }
      latexOptions = (latexResIni.data || []).map(f => ({ value: f.id, label: f.nome }));
      const entRes = await supa.from('entregas')
        .select('id, fornecedor_id, data, observacao, destino_fornecedor_id, destino:destino_fornecedor_id(nome), fornecedores:fornecedor_id(nome), entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
        .eq('etapa', 'cima')
        .eq('fornecedor_id', cimaFornecedorId)
        .order('data', { ascending: false })
        .order('id', { ascending: false });
      if (entRes.error) { toast('Erro ao carregar entregas de tecelagem', 'error'); console.error(entRes.error); }
      entregasCima = (entRes.data || []).filter(e => (e.entrega_itens || []).some(ei => ei.op_id === op.id));
      // Consolidação: uma OP Látex agrega N entregas via op_latex_entregas.
      // Mapeamos cada entrega vinculada -> sua OP Látex (todas as parciais
      // da mesma OP Tecelagem + destino apontam para a mesma OP).
      const latexOpsRes = await supa.from('ops').select('id, numero, ano, status, tipo, criado_em, lote_id, op_latex_entregas(entrega_id)').eq('tipo', 'latex').eq('origem_op_id', op.id);
      latexOpPorEntrega = {};
      latexOpInfo = {};
      for (const lo of (latexOpsRes.data || [])) {
        for (const link of (lo.op_latex_entregas || [])) {
          if (link.entrega_id == null) continue;
          latexOpPorEntrega[link.entrega_id] = lo.id;
          latexOpInfo[link.entrega_id] = { id: lo.id, numero: lo.numero, ano: lo.ano, status: lo.status, tipo: lo.tipo, criado_em: lo.criado_em, lote_id: lo.lote_id };
        }
      }

      // Blocos 4/7 da OP Em Produção Tecelagem: leituras read-only
      // adicionais (db/21_op_lifecycle_status_eventos.sql já aplicada em
      // staging para op_eventos; saldo_fios_op já existe e é escrita por
      // window.aplicarRecalculoOP em op-recalculo.js, não alterado aqui).
      // Puro SELECT — nenhuma escrita, nenhuma RPC de transição de status.
      // Erro ou ausência de dados cai no fallback controlado da UI.
      if (op.status === 'em_producao' && op.tipo !== 'latex') {
        const eventosRes = await supa.from('op_eventos')
          .select('id, tipo_evento, status_anterior, status_novo, observacao, criado_em')
          .eq('op_id', op.id)
          .order('criado_em', { ascending: false });
        opEventos = eventosRes.error ? [] : (eventosRes.data || []);

        const saldoOpRes = await supa.from('saldo_fios_op')
          .select('id, cor_id, cor_poliester, tipo, kg_sobra, cores:cor_id(id, nome)')
          .eq('op_id', op.id);
        saldoFiosOp = saldoOpRes.error ? [] : (saldoOpRes.data || []);
      }
    }
  } else {
    const numeroPreviewRes = await supa.from('op_numeros')
      .select('ultimo_numero')
      .eq('tipo', 'tecelagem')
      .eq('ano', ano)
      .maybeSingle();
    if (numeroPreviewRes.error) {
      console.error('op-nova: erro ao carregar previa de numeracao', numeroPreviewRes.error);
    }
    numero = (numeroPreviewRes.data && numeroPreviewRes.data.ultimo_numero ? Number(numeroPreviewRes.data.ultimo_numero) : 0) + 1;
  }

  if (pedidoIdState) {
    opSiblingOps = await loadPedidoSiblingOps(pedidoIdState);
  }

  // 3) Validação e persistência
  // itensValidos extraído para js/screens/op-persistir.js como
  // window.itensValidosOP(itens).
  // persistir (writes) extraído para js/screens/op-persistir.js como
  // window.persistirOP(...). O saving + toast + navigate ficam
  // nos callers (salvarSimulacao, abrirOP) abaixo.

  function erroSalvar(error) {
    if (error.code === '23505' || (error.message && error.message.includes('duplicate'))) toast(`Já existe OP nº ${numero} em ${ano}`, 'error');
    else toast('Erro ao salvar OP', 'error');
    console.error(error);
  }

  function bloquearSemPedido() {
    toast('Nao e possivel abrir OP sem Pedido vinculado.', 'error');
  }

  async function salvarSimulacao() {
    if (saving) return;
    saving = true;
    try {
      const numeroInt = parseInt(numero, 10), anoInt = parseInt(ano, 10);
      if (!pedidoIdState) { bloquearSemPedido(); return; }
      if (!numeroInt || !anoInt) { toast('Número e ano são obrigatórios', 'error'); return; }
      if (!clienteSel) { toast('Escolha o cliente', 'error'); return; }
      const validos = window.itensValidosOP(itens);
      if (validos.length === 0) { toast('Adicione ao menos 1 item com metros', 'error'); return; }

      const result = await window.persistirOP({
        status: 'simulada',
        op,
        numero, ano, clienteSel, itens, fornSel, modelosById, parametrosByLargura,
        pedidoId: pedidoIdState,
      });

      if (result.error) {
        if (result.step === 'ops_insert' || result.step === 'ops_update') {
          erroSalvar(result.error);
        } else if (result.step === 'pedido_required') {
          bloquearSemPedido();
        } else if (result.step === 'route_homogeneity') {
          toast(result.error.message, 'error');
        } else {
          toast('Erro ao salvar OP', 'error');
          console.error(result.error);
        }
        return;
      }
      toast('Simulação salva', 'success');
      navigate('#/ops');
    } finally { saving = false; }
  }
  async function abrirOP() {
    if (saving) return;
    saving = true;
    try {
      const numeroInt = parseInt(numero, 10), anoInt = parseInt(ano, 10);
      if (!pedidoIdState) { bloquearSemPedido(); return; }
      if (!numeroInt || !anoInt) { toast('Número e ano são obrigatórios', 'error'); return; }
      if (!clienteSel) { toast('Escolha o cliente', 'error'); return; }
      const validos = window.itensValidosOP(itens);
      if (validos.length === 0) { toast('Adicione ao menos 1 item com metros', 'error'); return; }
      if (!fornSel.cima) { toast('Escolha o fornecedor de tecelagem antes de abrir a OP', 'error'); return; }

      const result = await window.persistirOP({
        status: 'aberta',
        op,
        numero, ano, clienteSel, itens, fornSel, modelosById, parametrosByLargura,
        pedidoId: pedidoIdState,
      });

      if (result.error) {
        const mensagens = {
          op_numero_next: 'Erro ao reservar numero da OP',
          ops_insert: 'Erro ao salvar OP',
          ops_update: 'Erro ao salvar OP',
          lotes_insert: 'Erro ao criar lote',
          lotes_update: 'Erro ao atualizar lote',
          lotes_vincular: 'Erro ao vincular lote à OP',
          op_itens_delete: 'Erro ao salvar itens',
          op_itens_insert: 'Erro ao salvar itens',
          op_fornecedores_delete: 'Erro ao salvar fornecedor de tecelagem',
          op_fornecedores_insert: 'Erro ao salvar fornecedor de tecelagem',
          pedido_required: 'Nao e possivel abrir OP sem Pedido vinculado.',
          route_homogeneity: 'OP nao pode misturar Tapete e Manta; crie OPs separadas por tipo de produto.',
          ordens_compra_fio_delete: 'Falha ao gerar ordens de compra — OP mantida como simulada',
          ordens_compra_fio_insert: 'Falha ao gerar ordens de compra — OP mantida como simulada',
          regime_resolve: 'Falha ao resolver o regime de compra do Pedido — OP mantida como simulada',
          necessidades_sync: 'Falha ao sincronizar as necessidades de compra — OP mantida como simulada',
        };
        toast(mensagens[result.step] || 'Erro ao abrir OP', 'error');
        console.error(result.error);
        return;
      }
      toast(result.modelo === 'native' ? 'OP aberta — necessidades de compra sincronizadas' : 'OP aberta — ordens de compra geradas', 'success');
      navigate('#/ops');
    } finally { saving = false; }
  }

  async function excluirOP() {
    if (!op || !op.id) {
      toast('OP nao carregada.', 'error');
      return;
    }
    if (!window.RAVATEX_DELETE || typeof window.RAVATEX_DELETE.excluirOPComFluxo !== 'function') {
      toast('Exclusao controlada indisponivel.', 'error');
      return;
    }
    await window.RAVATEX_DELETE.excluirOPComFluxo(op.id, async function () {
      navigate('#/ops');
    });
  }

  // 4) Render
  function render() {
    container.replaceChildren(buildScreen());
  }

  function buildScreen() {
    // OP Em Producao Tecelagem tem modulo operacional proprio:
    // js/screens/op-tecelagem-producao-admin.js.
    if (isOpEmProducaoTecelagem()) {
      return window.renderOPTecelagemProducaoAdmin({
        op, numero, ano,
        pedidoCtx,
        opDisplayContext: opDisplayContext(),
        itens,
        opItensRaw,
        modelosById,
        forns,
        fornSel,
        ordens,
        entregasCima,
        latexOpPorEntrega,
        latexOpInfo,
        opEventos,
        saldoFiosOp,
        cimaFornecedorId,
        latexOptions,
        buildBlocoFios,
        reloadEntregasCima,
        excluirOP,
      });
    }

    const wrap = el('div', {});
    wrap.appendChild(buildHeader());

    const grid = isOpAbertaTecelagem()
      ? el('div', { style: 'display:grid;grid-template-columns:minmax(0,1fr) var(--rv-rail-w);gap:var(--rv-gap-cols);align-items:start;' })
      : el('div', { style: 'display:grid;grid-template-columns:1fr 288px;gap:16px;align-items:start;' });
    const leftCol = isOpAbertaTecelagem()
      ? el('div', { style: 'min-width:0;display:flex;flex-direction:column;gap:14px;' })
      : el('div', { style: 'display:flex;flex-direction:column;gap:16px;' });
    leftCol.appendChild(buildCardDados());
    leftCol.appendChild(buildCardItens());
    if (op && op.status !== 'simulada') leftCol.appendChild(buildBlocoFios());
    // ORDEM-COMPRA-B1 reader: linked purchase orders + lifecycle badges +
    // admin actions (tecelagem OPs only — látex OPs carry no fio orders).
    if (op && op.status !== 'simulada' && op.tipo !== 'latex') leftCol.appendChild(buildOrdensReaderSection());
    grid.appendChild(leftCol);
    grid.appendChild(buildRight());
    wrap.appendChild(grid);
    if (!isOpAbertaTecelagem()) wrap.appendChild(buildBottomInfoBar());
    return wrap;
  }

  function buildHeader() {
    const loteTxt = op && op.lote ? `Lote Nº ${op.lote.numero} · ${op.lote.cliente?.nome || '—'}` : '';
    let titulo = 'Nova OP de Tecelagem';
    let subtitulo = 'Monte a simulacao da tecelagem antes de abrir a OP.';

    if (hasLinkedPedido() && !op) {
      subtitulo = `Pedido Nº ${pedidoCtx.numero} como origem principal. Cliente derivado do pedido.`;
    } else if (isOpAbertaTecelagem()) {
      titulo = `OP Aberta de Tecelagem · ${formatOpDisplay(op)}`;
      subtitulo = hasLinkedPedido()
        ? `Preparacao da OP com Pedido Nº ${pedidoCtx.numero} como origem principal.`
        : 'Preparacao da OP de tecelagem antes da producao.';
    } else if (op) {
      titulo = formatOpDisplay(op);
      subtitulo = loteTxt || 'Acompanhamento da OP de tecelagem.';
    }

    if (isOpAbertaTecelagem()) return buildHeaderAbertaTecelagem();

    const headerLeft = el('div', {},
      el('div', { style: 'font-size:22px;font-weight:800;color:var(--rv-text-primary);letter-spacing:-.01em;' }, titulo),
      el('div', { style: 'font-size:13px;color:var(--rv-text-tertiary);margin-top:3px;line-height:1.45;' }, subtitulo),
    );
    var actions = [el('button', { type: 'button', style: BTN_BACK, onclick: () => navigate('#/ops') }, svgEl(SVG_BACK), 'Voltar')];
    if (op) {
      actions.unshift(el('button', {
        type: 'button',
        style: 'display:inline-flex;align-items:center;gap:7px;background:var(--rv-surface);color:var(--rv-signal-negative);border:1px solid var(--rv-signal-negative-border);border-radius:4px;padding:8px 16px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;',
        onclick: excluirOP,
      }, svgEl(SVG_TRASH), 'Excluir OP'));
    }

    return el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:22px;' },
      headerLeft,
      el('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;' }, actions),
    );
  }

  function internalOpLabel(opArg) {
    var api = window.RAVATEX_OP_DISPLAY;
    var legacy = api && typeof api.formatOpLegacyCode === 'function'
      ? api.formatOpLegacyCode(opArg)
      : formatOpDisplay(opArg);
    return legacy.replace(/^OP /, 'N\u00ba interno ');
  }

  function buildHeaderAbertaTecelagem() {
    var meta = [internalOpLabel(op)];
    if (hasLinkedPedido()) meta.push('Pedido N\u00ba ' + pedidoCtx.numero);
    meta.push(resolveClienteNome());
    if (op.lote) meta.push('Lote N\u00ba ' + op.lote.numero);
    if (op.criado_em) meta.push('Aberta em ' + fmtDateLabel(op.criado_em));

    return el('div', {},
      el('div', { style: 'display:flex;align-items:center;gap:6px;font-size:12px;color:var(--rv-text-tertiary);font-weight:500;margin-bottom:8px;' },
        el('button', { type: 'button', style: 'background:none;border:none;padding:0;font:inherit;color:var(--rv-text-tertiary);cursor:pointer;', onclick: function () { navigate('#/ops'); } }, 'OPs'),
        el('span', { style: 'color:var(--rv-text-tertiary);' }, '/'),
        el('span', { style: 'color:var(--rv-text-secondary);' }, formatOpDisplay(op))),
      el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:16px;' },
        el('div', { style: 'min-width:0;' },
          el('div', { style: 'display:flex;align-items:center;gap:11px;flex-wrap:wrap;' },
            el('h1', { style: 'margin:0;font-size:var(--rv-fs-title);font-weight:800;color:var(--rv-color-title);letter-spacing:-.02em;' }, formatOpDisplay(op)),
            rvStageTecelagemBadge(),
            rvStatusPrepBadge()),
          el('div', { style: 'font-size:12.5px;color:var(--rv-color-muted);margin-top:7px;line-height:1.5;' }, meta.join(' \u00b7 '))),
        el('div', { style: 'display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap;' },
          el('button', { type: 'button', style: RV_BTN_HDR_DANGER, onclick: excluirOP }, svgEl(SVG_TRASH), 'Excluir'))));
  }

  function buildBottomInfoBar() {
    let texto = 'Apos abrir a OP, voce podera acompanhar o andamento e gerenciar entregas nas proximas etapas.';
    if (!op) {
      texto = 'Abrir a OP nao inicia a producao — ela fica com status "Aberta" ate a fase futura de transicao.';
    } else if (isOpAbertaTecelagem()) {
      texto = 'Esta OP ja foi aberta e esta em preparacao — a producao nao e iniciada nesta fase.';
    }
    return el('div', { style: 'margin-top:16px;display:flex;align-items:center;gap:10px;background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:var(--rv-radius);padding:12px 16px;' },
      svgEl(SVG_INFO_BAR),
      el('span', { style: 'font-size:13px;color:var(--rv-text-secondary);' }, texto),
    );
  }

  function buildCardDados() {
    if (isOpAbertaTecelagem()) return buildCardDadosAbertaTecelagem();

    const numInput = disabledAttr(readOnly, textInput({ type: 'number', value: String(numero) }));
    styleInput(numInput);
    numInput.addEventListener('input', () => { numero = numInput.value; });
    const anoInput = disabledAttr(readOnly, textInput({ type: 'number', value: String(ano) }));
    styleInput(anoInput);
    anoInput.addEventListener('input', () => { ano = anoInput.value; });

    const clienteSelEl = disabledAttr(readOnly, selectInput({ options: clientesOptions, value: clienteSel, placeholder: 'Selecione o cliente...' }));
    styleSelect(clienteSelEl);
    clienteSelEl.addEventListener('change', () => { clienteSel = clienteSelEl.value ? Number(clienteSelEl.value) : ''; renderRight(); });

    const pedidoBlock = hasLinkedPedido()
      ? el('div', { style: 'margin-bottom:16px;background:var(--rv-surface-subtle);border:1px solid var(--rv-border);border-radius:var(--rv-radius);padding:14px 16px;' },
          el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;' },
            el('div', {},
              el('div', { style: 'font-size:12px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px;' }, 'Pedido vinculado'),
              el('div', { style: 'font-size:15px;font-weight:700;color:var(--rv-text-primary);' }, `Pedido Nº ${pedidoCtx.numero}`),
            ),
            el('button', {
              type: 'button',
              style: BTN_LINK + 'white-space:nowrap;',
              onclick: () => navigate('#/pedidos/' + pedidoCtx.id),
            }, 'Abrir pedido'),
          ),
          el('div', { style: 'font-size:12px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px;' }, 'Cliente derivado do pedido'),
          el('div', { style: 'font-size:14px;font-weight:600;color:var(--rv-text-primary);' }, resolveClienteNome()),
          buildPedidoMetaLine()
            ? el('div', { style: 'font-size:12.5px;color:var(--rv-text-secondary);line-height:1.5;margin-top:8px;' }, buildPedidoMetaLine())
            : '',
        )
      : fieldBlock('Cliente', wrapSelect(clienteSelEl), 'margin-bottom:16px;');

    return el('div', { style: CARD + 'padding:22px 24px;' },
      sectionHead(SVG_ICON_OP, isOpAbertaTecelagem() ? '1. Preparacao da OP' : '1. Dados da OP'),
      el('div', { style: 'display:grid;grid-template-columns:1fr 140px;gap:14px;margin-bottom:16px;' },
        fieldBlock('Número', numInput),
        fieldBlock('Ano', anoInput),
      ),
      pedidoBlock,
      buildFornField('Fornecedor de tecelagem (parte de cima)', 'cima'),
    );
  }

  function rvCampo(label, node) {
    return el('div', { style: 'min-width:0;' },
      el('label', { style: RV_FIELD_LABEL }, label),
      typeof node === 'string'
        ? el('div', { style: RV_VALUE }, node)
        : node);
  }

  function rvValor(text, color, weight) {
    return el('div', { style: RV_VALUE + (color ? 'color:' + color + ';' : '') + (weight ? 'font-weight:' + weight + ';' : '') }, text);
  }

  function fornecedorNomePorEtapa(etapa) {
    var id = fornSel[etapa];
    var found = forns.find(function (f) { return String(f.id) === String(id); });
    return found ? found.nome : '-';
  }

  function buildCardDadosAbertaTecelagem() {
    var pedidoNode = hasLinkedPedido()
      ? el('button', { type: 'button', style: 'background:none;border:none;padding:0;font:inherit;color:var(--rv-color-accent);font-weight:700;cursor:pointer;text-align:left;', onclick: function () { navigate('#/pedidos/' + pedidoCtx.id); } }, 'Pedido N\u00ba ' + pedidoCtx.numero)
      : rvValor('-', 'var(--rv-text-tertiary)');
    var loteLabel = op.lote ? 'Lote N\u00ba ' + op.lote.numero : '-';
    var itemLabel = opItensRaw.length
      ? opItensRaw.length + ' ' + (opItensRaw.length === 1 ? 'item' : 'itens') + ' do pedido'
      : '-';

    return el('div', { style: RV_CARD + 'padding:15px 17px;' },
      rvSectionPill('Dados da OP', IC_DADOS),
      el('div', { style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px 18px;' },
        rvCampo('Cliente', resolveClienteNome()),
        rvCampo('Lote', loteLabel),
        rvCampo('Fornecedor de tecelagem', fornecedorNomePorEtapa('cima')),
        rvCampo('Pedido vinculado', pedidoNode),
        rvCampo('Itens vinculados', itemLabel),
        rvCampo('Status', rvValor('Preparacao', 'var(--rv-status-prep)'))));
  }

  function buildCardItens() {
    if (isOpAbertaTecelagem()) return buildCardItensAbertaTecelagem();

    const modeloOptions = modelos.map(m => ({
      value: m.id,
      label: `${m.nome} ${larguraKey(m.largura)}m · ${m.cor_1?.nome}/${m.cor_2?.nome}`,
    }));

    const addBtn = el('button', {
      type: 'button', style: BTN_OUTLINE + 'font-size:13px;padding:7px 14px;',
      onclick: () => { itens.push({ modeloId: '', metros: '' }); render(); },
    }, svgEl(SVG_PLUS), 'Adicionar item');

    const header = el('div', { style: 'display:flex;align-items:center;justify-content:space-between;padding:0 24px 18px;' },
      el('div', { style: 'display:flex;align-items:center;gap:10px;' },
        sectionIcon(SVG_ICON_GRID),
        el('span', { style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);' }, '2. Itens da OP'),
        el('span', { style: 'font-size:13px;color:var(--rv-text-tertiary);font-weight:400;' }, '(modelo × metros)'),
      ),
      !readOnly ? addBtn : '',
    );

    const card = el('div', { style: CARD + 'padding:22px 0 0;' }, header);
    if (hasLinkedPedido()) {
      card.appendChild(el('div', { style: 'padding:0 24px 14px;font-size:12.5px;color:var(--rv-text-secondary);line-height:1.5;' },
        op ? 'Itens mantidos do pedido vinculado para rastreabilidade da OP.' : 'Itens carregados do pedido vinculado como base desta OP.'));
    }

    if (itens.length === 0) {
      card.appendChild(el('div', { style: 'display:grid;grid-template-columns:2fr 1fr 80px;gap:10px;padding:10px 24px;border-top:1px solid var(--rv-border);border-bottom:1px solid var(--rv-border);background:var(--rv-surface-subtle);' },
        el('div', { style: TH_STYLE }, 'MODELO'), el('div', { style: TH_STYLE }, 'METROS'), el('div', { style: TH_STYLE + 'text-align:right;' }, 'AÇÕES')));
      card.appendChild(el('div', { style: 'padding:48px 24px;display:flex;flex-direction:column;align-items:center;gap:10px;' },
        el('div', { style: 'width:48px;height:48px;border-radius:var(--rv-radius-pill);background:var(--rv-surface-subtle);display:flex;align-items:center;justify-content:center;' }, svgEl(SVG_EMPTY_BOX)),
        el('div', { style: 'font-size:15px;font-weight:700;color:var(--rv-text-primary);' }, 'Nenhum item adicionado'),
        el('div', { style: 'font-size:13px;color:var(--rv-text-tertiary);' }, 'Adicione ao menos um item para calcular o fio necessário.'),
      ));
    } else {
      // PASS-7-A4 §9: the row Modelo combobox has no individual visible label
      // — it is a grid cell. Its accessible name is the real column header of
      // the table it lives in, minted fresh per render so no stale id survives.
      opNovaLabelSeq += 1;
      const modeloColumnId = 'rv-op-nova-col-modelo-' + opNovaLabelSeq;
      card.appendChild(thRow('2fr 1fr 80px', ['MODELO', 'METROS', 'AÇÕES'],
        { alignLast: 'right', firstCellId: modeloColumnId }));
      const rows = el('div', { style: 'padding-bottom:6px;' });
      itens.forEach((item, idx) => rows.appendChild(buildItemRow(item, idx, modeloOptions, modeloColumnId)));
      card.appendChild(rows);
    }
    return card;
  }

  function buildItemRow(item, idx, modeloOptions, modeloColumnId) {
    const modeloSel = disabledAttr(readOnly, selectInput({ options: modeloOptions, value: item.modeloId, placeholder: 'Modelo...' }));
    styleSelect(modeloSel, 'padding:7px 30px 7px 10px;font-size:13.5px;');
    // PASS-7-A4 §9: named by the column it belongs to; many rows may share it.
    if (modeloColumnId && !modeloSel.getAttribute('aria-labelledby')
      && !modeloSel.getAttribute('aria-label')) {
      modeloSel.setAttribute('aria-labelledby', modeloColumnId);
    }
    modeloSel.addEventListener('change', () => { item.modeloId = modeloSel.value ? Number(modeloSel.value) : ''; renderRight(); });

    const metrosInput = disabledAttr(readOnly, textInput({ type: 'number', value: item.metros === '' ? '' : String(item.metros), placeholder: 'metros' }));
    styleInput(metrosInput, 'padding:7px 10px;font-size:13.5px;');
    metrosInput.addEventListener('input', () => { item.metros = metrosInput.value === '' ? '' : Number(metrosInput.value); renderRight(); });

    const acoes = el('div', { style: 'display:flex;justify-content:flex-end;' });
    if (!readOnly) {
      acoes.appendChild(el('button', {
        type: 'button', style: 'background:none;border:none;cursor:pointer;color:var(--rv-signal-negative);padding:2px;display:inline-flex;',
        onclick: () => { itens.splice(idx, 1); render(); },
      }, svgEl(SVG_TRASH)));
    }

    return el('div', { style: 'display:grid;grid-template-columns:2fr 1fr 80px;gap:10px;padding:9px 24px;align-items:center;border-bottom:1px solid var(--rv-border-soft);' },
      wrapSelect(modeloSel, true), metrosInput, acoes);
  }

  function rvThRow(colsTemplate, labels) {
    return el('div', { style: 'display:grid;grid-template-columns:' + colsTemplate + ';gap:10px;padding:9px 17px;background:var(--rv-color-bg-header);border-top:1px solid var(--rv-color-line-200);border-bottom:1px solid var(--rv-color-line-200);' },
      labels.map(function (label, idx) {
        return el('div', { style: RV_TH_STYLE + (idx > 0 ? 'text-align:right;' : '') }, label);
      }));
  }

  function rvGridRow(colsTemplate, cells) {
    return el('div', { style: 'display:grid;grid-template-columns:' + colsTemplate + ';gap:10px;padding:11px 17px;border-bottom:1px solid var(--rv-color-line-100);align-items:center;' }, cells);
  }

  function buildCardItensAbertaTecelagem() {
    var cols = 'minmax(220px,1fr) 130px 150px';
    var card = el('div', { style: RV_CARD + 'overflow:hidden;' },
      el('div', { style: 'display:flex;align-items:center;gap:8px;padding:15px 17px 12px;' },
        rvSectionPill('Itens da OP', IC_ITENS),
        el('span', { style: 'font-size:11.5px;color:var(--rv-color-muted);font-weight:400;margin-bottom:14px;' }, 'modelo x metros')));

    if (!opItensRaw.length) {
      card.appendChild(el('div', { style: 'padding:0 17px 18px;font-size:13px;color:var(--rv-text-tertiary);' }, 'Nenhum item vinculado a esta OP.'));
      return card;
    }

    var table = el('div', { style: 'overflow-x:auto;' });
    var inner = el('div', { style: 'min-width:520px;' });
    inner.appendChild(rvThRow(cols, ['MODELO / CORES', 'PEDIDO', 'ITEM DO PEDIDO']));
    opItensRaw.forEach(function (item) {
      var itemPedidoLabel = (hasLinkedPedido() && item.pedido_item_id) ? 'Pedido N\u00ba ' + pedidoCtx.numero : '-';
      inner.appendChild(rvGridRow(cols, [
        el('div', { style: 'font-size:13px;font-weight:600;color:var(--rv-color-value);' }, window.rotuloModelo(modelosById[item.modelo_id])),
        el('div', { class: 'num', style: 'font-size:13px;text-align:right;color:var(--rv-text-primary);font-variant-numeric:tabular-nums;' }, window.fmtMetros(item.metros_pedidos)),
        el('div', { style: 'font-size:12.5px;text-align:right;color:var(--rv-color-accent);font-weight:600;' }, itemPedidoLabel),
      ]));
    });
    table.appendChild(inner);
    card.appendChild(table);
    return card;
  }

  function buildFornField(label, etapa) {
    const fornsTipo = etapa === 'cima' ? fornsPorTipo('tecelagem') : fornsPorTipo(etapa);
    const sel = disabledAttr(readOnly, selectInput({ options: fornsTipo, value: fornSel[etapa], placeholder: 'Selecione o fornecedor...' }));
    styleSelect(sel);
    sel.addEventListener('change', () => { fornSel[etapa] = sel.value ? Number(sel.value) : ''; renderRight(); });
    return fieldBlock(label, wrapSelect(sel));
  }




  // ORDEM-COMPRA-B1: fetch ordens_compra_fio including the db/65 lifecycle
  // dimension columns, with a defensive fallback. The extended select errors
  // with 42703 (undefined_column) on a database where db/65 has not been
  // applied (production, pre-Phase-A there); we then retry with the legacy
  // column list and mark ordensDimDisponivel=false so the reader degrades to
  // legacy read-only rows — the existing OP screen never regresses. Genuine
  // (non-missing-column) errors are surfaced unchanged, as before.
  // OCF_SELECT_LEGACY/OCF_SELECT_DIM are module-level constants (top of the
  // IIFE) so the initial-load call site is never in their TDZ.
  // PHASE-C3C-B (docs/architecture/ORDEM_COMPRA_C3C_B_PHASE_CONTRACT.md §32):
  // minimal wiring only — attempts the canonical legacy-compat projection
  // (item x OP grain, scoped by p_op_id) first; falls back to the exact
  // pre-phase dim/legacy select below, unchanged, on the documented inactive
  // signal or the bounded missing-function condition. ordensDimDisponivel is
  // deliberately left at its default (false) on a canonical response: the
  // canonical projection does not project legado_recebimento_automatico
  // (§32.6), and ocfIsLegacy's read-only fallback is the conservative choice
  // rather than guessing that field's value.
  async function fetchOrdensCompraFio(opId) {
    const cutover = window.RAVATEX_SCREENS && window.RAVATEX_SCREENS.ordemCompraReceiptCutover;
    if (cutover) {
      const canonical = await cutover.attemptCanonicalRead({ opId: opId });
      if (canonical.outcome === 'canonical_success') return { data: canonical.rows, error: null };
      if (canonical.outcome === 'hard_failure') return { data: null, error: canonical.error };
      // outcome === 'legacy_fallback' — fall through to the exact existing
      // dim/legacy read below.
    }
    const dimRes = await supa.from('ordens_compra_fio').select(OCF_SELECT_DIM).eq('op_id', opId);
    if (!dimRes.error) { ordensDimDisponivel = true; return dimRes; }
    const semColuna = dimRes.error.code === '42703'
      || /column .* does not exist/i.test(dimRes.error.message || '');
    if (!semColuna) return dimRes;
    ordensDimDisponivel = false;
    return await supa.from('ordens_compra_fio').select(OCF_SELECT_LEGACY).eq('op_id', opId);
  }

  async function reloadOrdens() {
    if (!op || op.status === 'simulada') return;
    const r = await fetchOrdensCompraFio(op.id);
    if (r.error) { toast('Erro ao recarregar ordens de fio', 'error'); console.error(r.error); return; }
    ordens = r.data || [];
    render();
  }

  function buildOrdemPendenteRow(ordem) {
    const kgInput = textInput({ type: 'number', step: '0.001', value: String(ordem.kg_pedido) });
    styleInput(kgInput, 'width:100px;padding:7px 10px;font-size:13px;');
    const dataInput = textInput({ type: 'date', value: new Date().toISOString().slice(0, 10) });
    styleInput(dataInput, 'width:140px;padding:7px 10px;font-size:13px;');
    // PHASE-C3C-B §34: this row owns its own idempotency-attempt tracker,
    // alive for the row's lifetime (recreated only when this row itself is
    // rebuilt, e.g. after a successful reloadOrdens()) — never recreated per
    // click. A retry of unchanged intent (same kg/date) after an ambiguous
    // transport failure reuses the same token; any deterministic outcome
    // closes it, so the next click — even with unchanged values — mints a
    // new one.
    const cutoverApi = window.RAVATEX_SCREENS && window.RAVATEX_SCREENS.ordemCompraReceiptCutover;
    const attemptTracker = cutoverApi ? cutoverApi.createAttemptTracker() : null;
    const btn = el('button', {
      type: 'button', style: BTN_SOLID_SM,
      onclick: async () => {
        const kg = Number(kgInput.value);
        if (!(kg > 0)) { toast('Informe o kg recebido', 'error'); return; }
        const dataRec = dataInput.value || new Date().toISOString().slice(0, 10);
        const status = kg < Number(ordem.kg_pedido) ? 'recebido_parcial' : 'recebido_total';
        btn.disabled = true;
        const attempt = attemptTracker
          ? attemptTracker.resolveAttempt({ ordemId: ordem.id, kg: kg, dataRec: dataRec })
          : undefined;
        const { error, ambiguous } = await window.registrarRecebimentoOrdemFio({
          ordemId: ordem.id,
          kgRecebido: kg,
          dataRecebimento: dataRec,
          status,
          attempt,
        });
        if (error) {
          toast('Erro ao registrar recebimento', 'error'); console.error(error); btn.disabled = false;
          if (attemptTracker && !ambiguous) attemptTracker.complete();
          return;
        }
        if (attemptTracker) attemptTracker.complete();
        toast('Recebimento registrado', 'success');
        reloadOrdens();
      }
    }, 'Registrar');

    return el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 24px;border-bottom:1px solid var(--rv-border-soft);' },
      el('div', {},
        el('div', { style: 'font-size:14px;font-weight:600;color:var(--rv-text-primary);' }, window.rotuloFio(ordem)),
        el('div', { style: 'font-size:12px;color:var(--rv-text-tertiary);margin-top:2px;' }, 'Pedido: ' + window.fmtKg(ordem.kg_pedido)),
      ),
      el('div', { style: 'display:flex;align-items:flex-end;gap:10px;flex-shrink:0;' },
        el('div', {}, el('div', { style: 'font-size:11px;font-weight:600;color:var(--rv-text-tertiary);margin-bottom:5px;' }, 'Kg recebido'), kgInput),
        el('div', {}, el('div', { style: 'font-size:11px;font-weight:600;color:var(--rv-text-tertiary);margin-bottom:5px;' }, 'Data'), dataInput),
        btn,
      ),
    );
  }

  // REFUND-B1 (§R.22.11) — the OP screen keeps only a COMPACT read-only
  // summary of this OP's yarn purchase orders (fio · fornecedor · qty ·
  // dimension badges) plus a "Ver ordens de compra" link to the dedicated
  // entity screen (#/ordens-compra). The inline emit/cancel entity actions
  // were REMOVED here: administrative authority for purchase orders lives on
  // the dedicated screen, never in a summary section or a transition modal
  // (governance §R.16). Receipt inputs (buildOrdemPendenteRow / buildBlocoFios)
  // remain untouched (Phase C).

  function ocfFornecedorNome(ordem) {
    if (!ordem || ordem.fornecedor_id == null) return null;
    var f = (forns || []).find(function (x) { return x.id === ordem.fornecedor_id; });
    return f ? f.nome : null;
  }
  // Legacy = pre-lifecycle row (db/65 backfilled it 'emitida'/legacy), a
  // cancelled row, or a database without the dimension layer → read-only.
  function ocfIsLegacy(ordem) {
    return !ordensDimDisponivel
      || ordem.legado_recebimento_automatico === true
      || ordem.status_administrativo == null;
  }
  // Emit/cancel entity actions removed from the OP screen (REFUND-B1,
  // §R.22.11): purchase-order administrative authority lives on the
  // dedicated #/ordens-compra screen. This section is summary-only.
  function ocfQtd(ordem) {
    const parcial = ordem.status_recebimento === 'parcial'
      || (ordem.kg_recebido != null && Number(ordem.kg_recebido) > 0 && Number(ordem.kg_recebido) < Number(ordem.kg_pedido));
    if (parcial) return window.fmtKg(ordem.kg_recebido) + ' / ' + window.fmtKg(ordem.kg_pedido);
    return window.fmtKg(ordem.kg_pedido);
  }
  function ocfBadges(ordem) {
    const admin = ocfIsLegacy(ordem) ? 'emitida' : ordem.status_administrativo;
    const aceite = ocfIsLegacy(ordem) ? 'nao_aplicavel' : (ordem.status_aceite || 'nao_aplicavel');
    const receb = ordem.status_recebimento || 'nao_recebido';
    return el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;' },
      ocfAdminBadge(admin), ocfAceiteBadge(aceite), ocfRecebBadge(receb));
  }
  function buildOrdensReaderSection() {
    const box = el('div', { id: 'ordens-compra-reader', style: CARD + 'padding:0;overflow:hidden;margin-top:16px;' });
    const chip = ocConfig.exige_aceite
      ? ocfPill('Aceite exigido', 'var(--rv-status-prod-bg)', 'var(--rv-status-prod)', true)
      : ocfPill('Aceite dispensado', 'var(--rv-surface-subtle)', 'var(--rv-text-tertiary)', false);
    // Navigation to the dedicated purchase-order entity screen (REFUND-B1).
    const verLink = el('a', {
      href: '#/ordens-compra', id: 'ordens-compra-ver-link',
      style: 'font-size:12px;font-weight:600;color:var(--rv-accent-blue);text-decoration:none;white-space:nowrap;',
    }, 'Ver ordens de compra →');
    const distributionLink = hasLinkedPedido()
      ? el('button', { type: 'button', id: 'op-abrir-distribuicao-pedido', style: 'font-size:12px;font-weight:600;color:var(--rv-accent-blue);background:none;border:none;padding:0;cursor:pointer;', onclick: function () { navigate('#/pedidos/' + pedidoCtx.id + '/insumos'); } }, 'Distribuir no Pedido →')
      : null;
    box.appendChild(el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 24px 12px;' },
      el('span', { style: 'font-size:11px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.06em;text-transform:uppercase;' }, 'Ordens de compra de fio'),
      el('div', { style: 'display:flex;align-items:center;gap:12px;' }, chip, distributionLink, verLink)));
    if (!ordens.length) {
      box.appendChild(el('div', { style: 'padding:0 24px 18px;font-size:13px;color:var(--rv-text-tertiary);' }, 'Nenhuma ordem de compra de fio gerada.'));
      return box;
    }
    const cols = 'minmax(120px,1.3fr) minmax(110px,1fr) 120px minmax(230px,1.7fr)';
    box.appendChild(thRow(cols, ['FIO', 'FORNECEDOR', 'QTD (KG)', 'SITUAÇÃO']));
    ordens.forEach(function (o) {
      const forn = ocfFornecedorNome(o);
      box.appendChild(gridRow(cols, [
        el('div', { style: 'font-size:13.5px;font-weight:500;color:var(--rv-text-primary);' }, window.rotuloFio(o)),
        el('div', { style: 'font-size:13px;color:' + (forn ? 'var(--rv-text-primary)' : 'var(--rv-text-tertiary)') + ';' }, forn || '— não atribuído'),
        el('div', { class: 'num', style: 'font-size:13px;color:var(--rv-text-primary);font-variant-numeric:tabular-nums;' }, ocfQtd(o)),
        ocfBadges(o),
      ]));
    });
    box.appendChild(el('div', { style: 'padding:11px 24px;border-top:1px solid var(--rv-border-soft);background:var(--rv-surface);font-size:11.5px;color:var(--rv-text-tertiary);' },
      'A administração das ordens de compra (emitir, cancelar, itens) fica na tela dedicada — esta seção é apenas um resumo.'));
    return box;
  }

  function buildBlocoFios() {
    const box = el('div', { id: isOpAbertaTecelagem() ? 'insumos-open-op' : null, style: (isOpAbertaTecelagem() ? RV_CARD : CARD) + 'padding:0;overflow:hidden;' });
    // Título/ícone dependem do contexto: OP Aberta usa a linguagem de
    // preparação (com ícone, como os demais cards dessa tela); OP Em
    // Produção usa o texto do standalone PROD-OP-TECELAGEM ("3. Insumos
    // — recebimento de fios"), que não usa ícones em nenhum dos 7
    // blocos — confirmado card a card no markup de referência.
    if (op.status === 'aberta') {
      // OP Aberta: linguagem de preparação (ícone grande + título 16px).
      box.appendChild(el('div', { style: 'padding:15px 17px 12px;' },
        rvSectionPill('Insumos - recebimento de fios', IC_FIOS)));
    } else {
      // OP Em Produção: header no padrão Inttex (icon-chip 22px + rótulo
      // UPPERCASE), consistente com os demais blocos do cockpit de produção
      // (js/screens/op-tecelagem-producao-admin.js).
      const chipFios = el('span', { style: 'display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:var(--rv-radius-control);background:var(--rv-color-chip-bg);border:1px solid var(--rv-color-line-200);color:var(--rv-color-chip-glyph);flex-shrink:0;' },
        svgEl('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'));
      box.appendChild(el('div', { style: 'display:flex;align-items:center;gap:9px;padding:15px 17px 12px;' },
        chipFios,
        el('span', { style: 'font-size:11px;font-weight:700;color:var(--rv-color-section-label);letter-spacing:.06em;text-transform:uppercase;' }, 'Insumos — recebimento de fios')));
    }

    if (ordens.length) {
      box.appendChild(el('div', { style: isOpAbertaTecelagem() ? 'padding:0 17px 14px;' : 'padding:0 24px 16px;' },
        el('button', {
          type: 'button', style: BTN_LINK + 'margin:0;',
          onclick: () => window.gerarPdfCompraFios({ op, ordens }),
        }, svgEl(SVG_PDF), 'PDF de compra de fios')));
    }

    if (op.status === 'aberta') {
      box.appendChild(el('div', { id: 'op-purchase-assignment-readonly', style: 'padding:0 24px 16px;font-size:12.5px;color:var(--rv-text-secondary);' },
        'A escolha do fornecedor de compra é feita em Pedido → Insumos. Esta OP apenas consulta a disponibilidade.'));
      const pendentes = ordens.filter(o => o.status === 'pendente');
      const recebidas = ordens.filter(o => o.status !== 'pendente');

      box.appendChild(el('div', { style: 'padding:10px 24px 6px;border-top:1px solid var(--rv-border);' },
        el('span', { style: 'font-size:10.5px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.06em;' }, 'PENDENTES')));
      if (pendentes.length === 0) {
        box.appendChild(el('div', { style: 'padding:0 24px 16px;font-size:13px;color:var(--rv-text-tertiary);' }, 'Nenhuma ordem pendente.'));
      } else {
        const wrap = el('div', {});
        pendentes.forEach(o => wrap.appendChild(buildOrdemPendenteRow(o)));
        box.appendChild(wrap);
      }

      if (recebidas.length) {
        box.appendChild(el('div', { style: 'padding:14px 24px 0;' },
          el('div', { style: 'font-size:10.5px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.06em;margin-bottom:10px;' }, 'RECEBIDAS')));
        box.appendChild(thRow('1fr 140px 140px 120px', ['FIO', 'PEDIDO', 'RECEBIDO', 'STATUS']));
        for (const o of recebidas) {
          box.appendChild(gridRow('1fr 140px 140px 120px', [
            el('div', { style: 'font-size:13.5px;font-weight:500;color:var(--rv-text-primary);' }, window.rotuloFio(o)),
            el('div', { style: 'font-size:13.5px;color:var(--rv-text-primary);' }, window.fmtKg(o.kg_pedido)),
            el('div', { style: 'font-size:13.5px;color:var(--rv-text-primary);' }, window.fmtKg(o.kg_recebido)),
            el('div', { style: 'font-size:13px;color:var(--rv-signal-positive);font-weight:600;' }, OCF_STATUS_LABEL[o.status] || o.status),
          ]));
        }
      }

      const todasRecebidas = ordens.length > 0 && pendentes.length === 0;
      if (!todasRecebidas) {
        box.appendChild(el('div', { style: 'display:flex;align-items:center;gap:8px;padding:12px 24px;border-top:1px solid var(--rv-border);background:var(--rv-signal-caution-bg);' },
          svgEl(SVG_WARNING),
          el('span', { style: 'font-size:12.5px;color:var(--rv-signal-caution);' }, `Aguardando recebimento de ${pendentes.length} fio(s) para calcular a proposta de ajuste.`)));
        return box;
      }
      box.appendChild(buildProposta());
    } else {
      box.appendChild(el('div', { style: 'border-top:1px solid var(--rv-border);' }));
      box.appendChild(thRow('1fr 140px 140px 120px', ['FIO', 'PEDIDO', 'RECEBIDO', 'STATUS']));
      for (const o of ordens) {
        box.appendChild(gridRow('1fr 140px 140px 120px', [
          el('div', { style: 'font-size:13.5px;font-weight:500;color:var(--rv-text-primary);' }, window.rotuloFio(o)),
          el('div', { style: 'font-size:13.5px;color:var(--rv-text-primary);' }, window.fmtKg(o.kg_pedido)),
          el('div', { style: 'font-size:13.5px;color:var(--rv-text-primary);' }, o.kg_recebido == null ? '—' : window.fmtKg(o.kg_recebido)),
          el('div', { style: 'font-size:13px;color:var(--rv-text-primary);font-weight:600;' }, OCF_STATUS_LABEL[o.status] || o.status),
        ]));
      }

      if (ordens.length > 0 && ordens.every(o => o.status !== 'pendente')) {
        box.appendChild(el('div', { style: 'display:flex;align-items:center;gap:8px;padding:11px 24px;border-top:1px solid var(--rv-border);background:var(--rv-surface);' },
          svgEl(SVG_CHECK_SM),
          el('span', { style: 'font-size:12px;color:var(--rv-text-secondary);' }, 'Todos os fios desta OP já foram recebidos.')));
      }

      box.appendChild(el('div', { style: 'padding:16px 24px 0;' },
        el('div', { style: 'font-size:13px;font-weight:700;color:var(--rv-text-primary);margin-bottom:4px;' }, 'Metros de produção')));
      box.appendChild(thRow('1fr 140px 140px', ['MODELO', 'PEDIDO', 'PRODUÇÃO']));
      for (const i of opItensRaw) {
        box.appendChild(gridRow('1fr 140px 140px', [
          el('div', { style: 'font-size:13.5px;font-weight:500;color:var(--rv-text-primary);' }, window.rotuloModelo(modelosById[i.modelo_id])),
          el('div', { style: 'font-size:13.5px;color:var(--rv-text-primary);' }, window.fmtMetros(i.metros_pedidos)),
          el('div', { style: 'font-size:13.5px;color:var(--rv-text-primary);' }, i.metros_ajustados == null ? window.fmtMetros(i.metros_pedidos) : window.fmtMetros(i.metros_ajustados)),
        ]));
      }
      box.appendChild(el('div', { style: 'height:8px;' }));
    }
    return box;
  }

  async function reloadEntregasCima() {
    const entRes = await supa.from('entregas')
      .select('id, fornecedor_id, data, observacao, destino_fornecedor_id, destino:destino_fornecedor_id(nome), fornecedores:fornecedor_id(nome), entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
      .eq('etapa', 'cima')
      .eq('fornecedor_id', cimaFornecedorId)
      .order('data', { ascending: false })
      .order('id', { ascending: false });
    if (entRes.error) { toast('Erro ao recarregar entregas', 'error'); console.error(entRes.error); return; }
    entregasCima = (entRes.data || []).filter(e => (e.entrega_itens || []).some(ei => ei.op_id === op.id));
    const latexOpsRes = await supa.from('ops').select('id, numero, ano, status, op_latex_entregas(entrega_id)').eq('tipo', 'latex').eq('origem_op_id', op.id);
    latexOpPorEntrega = {};
    latexOpInfo = {};
    for (const lo of (latexOpsRes.data || [])) {
      for (const link of (lo.op_latex_entregas || [])) {
        if (link.entrega_id == null) continue;
        latexOpPorEntrega[link.entrega_id] = lo.id;
        latexOpInfo[link.entrega_id] = { id: lo.id, numero: lo.numero, ano: lo.ano, status: lo.status };
      }
    }
    render();
  }

  // Limite individual de metros de um item assumindo os demais em zero
  // (cada cor consumida pelo item × kg_recebido daquela cor). Usado pra capar o slider.
  // Extraído para js/screens/op-recalculo.js como window.maxMetrosItem.

  function buildProposta() {
    // YARN-BUTTONS-FINAL-CONTRACT: bloco de distribuição COMPARTILHADO
    // (js/screens/op-distribuicao-ui.js) — a MESMA implementação
    // consumida pelo painel do Pedido (pedido-detail-events.js). Rodapé =
    // [Manter pedido, Salvar distribuição], ambos save-only; nenhum inicia
    // produção. "Iniciar produção" mora no rail (buildAcaoAberta).
    return window.buildDistribuicaoBlock({
      op: op,
      opItens: opItensRaw,
      ordens: ordens,
      modelosById: modelosById,
      parametrosByLargura: parametrosByLargura,
      variant: 'full',
      onSaved: function (savedMap) {
        // Reflete a distribuição recém-salva em memória e re-renderiza,
        // para o "Iniciar produção" do rail reavaliar sua habilitação.
        for (var i = 0; i < opItensRaw.length; i++) {
          var it = opItensRaw[i];
          if (savedMap[it.id] != null) it.metros_ajustados = savedMap[it.id];
        }
        render();
      },
    });
  }

  let rightNode = null;
  function buildRight() {
    if (isOpAbertaTecelagem()) return buildRightAbertaTecelagem();
    rightNode = el('div', { style: CARD + 'padding:20px;' });
    renderRightInto();
    return rightNode;
  }
  function renderRight() { if (rightNode) renderRightInto(); }

  function metricRow(label, value, color) {
    return el('div', { style: 'display:flex;align-items:baseline;justify-content:space-between;gap:12px;' },
      el('span', { style: 'font-size:12.5px;color:var(--rv-text-secondary);flex:1;min-width:0;' }, label),
      el('span', { style: 'font-size:15px;font-weight:700;color:' + (color || 'var(--rv-color-title)') + ';white-space:nowrap;font-variant-numeric:tabular-nums;' }, value));
  }

  function sumMetrosAbertos() {
    return Math.round(opItensRaw.reduce(function (acc, item) {
      return acc + Number(item.metros_pedidos || 0);
    }, 0) * 100) / 100;
  }

  function buildRightAbertaTecelagem() {
    var calc = null;
    try {
      calc = calcularFiosOP(itens, modelosById, parametrosByLargura);
    } catch (err) {
      calc = null;
    }
    var rail = el('div', { style: 'min-width:0;position:sticky;top:0;display:flex;flex-direction:column;gap:14px;' });
    rail.appendChild(buildResumoAberta(calc));
    rail.appendChild(buildAcaoAberta());
    rail.appendChild(buildDocumentosAberta());
    return rail;
  }

  function buildResumoAberta(calc) {
    var algodaoTotal = calc
      ? Object.values(calc.algodaoPorCor).reduce(function (acc, row) { return acc + Number(row.kg || 0); }, 0)
      : 0;
    var poliTotal = calc ? Number(calc.poliester.PRETO || 0) + Number(calc.poliester.BRANCO || 0) : 0;
    return el('div', { style: RV_CARD + 'padding:15px 17px;' },
      rvSectionPill('Resumo desta OP', IC_RESUMO),
      el('div', { style: 'display:flex;flex-direction:column;gap:11px;' },
        metricRow('Total pedido', window.fmtMetros(sumMetrosAbertos()), 'var(--rv-color-title)'),
        metricRow('Itens vinculados', String(opItensRaw.length), 'var(--rv-color-title)'),
        metricRow('Ordens de fio', String(ordens.length), ordens.length ? 'var(--rv-color-accent)' : 'var(--rv-text-tertiary)'),
        metricRow('Algodao estimado', window.fmtKg ? window.fmtKg(algodaoTotal) : (algodaoTotal.toFixed(3) + ' kg')),
        metricRow('Poliester estimado', window.fmtKg ? window.fmtKg(poliTotal) : (poliTotal.toFixed(3) + ' kg'))),
      hasLinkedPedido()
        ? el('div', { style: 'margin-top:13px;padding-top:12px;border-top:1px solid var(--rv-color-line-100);font-size:11.5px;color:var(--rv-text-tertiary);line-height:1.45;' }, 'Origem: Pedido N\u00ba ' + pedidoCtx.numero)
        : '');
  }

  function buildAcaoAberta() {
    // YARN-BUTTONS-FINAL-CONTRACT — Surface 1: UMA ação primária,
    // "Iniciar produção" (builder COMPARTILHADO, o mesmo consumido pelo
    // painel do Pedido). Único ponto de início de produção. Habilita só
    // com distribuição salva + fio recebido cobrindo; senão desabilitado
    // com title explicativo (inclui "aguardando recebimento dos fios").
    var api = window.RAVATEX_SCREENS.opDistribuicao;
    var st = api.iniciarProducaoState(opItensRaw, ordens, modelosById, parametrosByLargura);
    // §2.1 (D9): o estado desabilitado nao troca cores — ele e opacidade.
    // Declarado explicitamente, nunca derivado do estilo habilitado por
    // substituicao de string.
    var styleDisabled = RV_BTN_PRIMARY_DISABLED;
    var btnIniciar = api.buildIniciarProducaoButton({
      op: op,
      opItens: opItensRaw,
      ordens: ordens,
      modelosById: modelosById,
      parametrosByLargura: parametrosByLargura,
      styleEnabled: RV_BTN_PRIMARY,
      styleDisabled: styleDisabled,
      onIniciado: function () { navigate('#/ops'); },
    });
    var detail = st.habilitado
      ? 'Distribuição salva e fios recebidos — pronto para iniciar a produção.'
      : (st.motivo || '');
    return el('div', { style: RV_CARD + 'padding:15px 17px;' },
      rvSectionPill('Preparacao', IC_MOV),
      btnIniciar,
      el('div', { style: 'font-size:11.5px;color:var(--rv-text-tertiary);margin-top:9px;line-height:1.45;' }, detail));
  }

  function buildDocumentosAberta() {
    var tipos = ['Romaneio', 'NF de entrada', 'NF de saida'];
    var card = el('div', { id: 'documentos-op', style: RV_CARD + 'padding:15px 17px;' },
      rvSectionPill('Documentos', IC_DOC));
    tipos.forEach(function (tipo, idx) {
      card.appendChild(el('div', { style: idx > 0 ? 'border-top:1px solid var(--rv-color-line-100);margin-top:13px;padding-top:13px;' : '' },
        el('div', { style: 'display:flex;align-items:center;gap:7px;margin-bottom:8px;' },
          el('span', { style: 'font-size:12px;font-weight:600;color:var(--rv-color-value);' }, tipo),
          el('span', { 'data-ui-pill': '1', style: 'font-size:var(--rv-fs-micro);font-weight:600;color:var(--rv-color-accent);background:var(--rv-color-subtle-bg);padding:1px 6px;border-radius:var(--rv-radius-pill);' }, '0')),
        el('div', { style: 'font-size:11.5px;color:var(--rv-text-tertiary);margin-bottom:8px;' }, 'Nenhum arquivo anexado.'),
        el('button', {
          type: 'button',
          style: RV_BTN_DASHED,
          onclick: function () { toast('Anexo de documentos sera integrado (Google Drive) em breve.', 'info'); },
        }, svgEl(IC_CLIP), 'Anexar ' + tipo)));
    });
    return card;
  }

  function renderRightInto() {
    let calc;
    try {
      calc = calcularFiosOP(itens, modelosById, parametrosByLargura);
    } catch (err) {
      rightNode.replaceChildren(el('p', { style: 'font-size:13px;color:var(--rv-signal-negative);' }, err.message));
      return;
    }
    const fmt = (n) => Number(n).toFixed(3).replace('.', ',') + ' kg';
    const semItens = window.itensValidosOP(itens).length === 0;
    const statusLabel = !op
      ? 'Simulacao'
      : isOpAbertaTecelagem()
        ? 'Preparacao'
        : humanizeLabel(op.status);

    const children = [
      el('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:16px;' },
        el('div', { style: 'width:40px;height:40px;border-radius:var(--rv-radius);background:var(--rv-pill-info-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;' }, svgEl(SVG_ICON_SUMMARY)),
        el('div', {},
          el('div', { style: 'font-size:15px;font-weight:700;color:var(--rv-text-primary);' }, 'Resumo da OP'),
          el('span', { style: 'display:inline-block;margin-top:4px;background:var(--rv-pill-info-bg);color:var(--rv-accent-blue);font-size:11.5px;font-weight:600;border-radius:4px;padding:2px 8px;' }, statusLabel),
        ),
      ),
      el('div', { style: 'font-size:13px;color:var(--rv-text-secondary);font-weight:500;margin-bottom:4px;' }, op ? formatOpDisplay(op) : `OP ${numero || '—'}/${ano || '—'}`),
      op ? el('div', { style: 'font-size:11.5px;color:var(--rv-text-tertiary);margin-bottom:16px;' }, `Nº interno ${op.numero}/${op.ano}`) : '',
      el('div', { style: 'height:1px;background:var(--rv-surface-subtle);margin-bottom:16px;' }),
    ];

    if (hasLinkedPedido()) {
      children.push(
        el('div', { style: 'font-size:10.5px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.06em;margin-bottom:6px;' }, 'ORIGEM'),
        el('div', { style: 'font-size:13.5px;font-weight:700;color:var(--rv-text-primary);margin-bottom:4px;' }, `Pedido Nº ${pedidoCtx.numero}`),
        el('div', { style: 'font-size:12.5px;color:var(--rv-text-secondary);margin-bottom:14px;line-height:1.5;' }, 'Cliente derivado do pedido: ' + resolveClienteNome()),
      );
    }

    children.push(el('div', { style: 'font-size:13px;font-weight:700;color:var(--rv-text-primary);margin-bottom:14px;' }, 'Fio necessário'));

    const algEntries = Object.values(calc.algodaoPorCor);
    const algKids = [el('div', { style: 'font-size:10.5px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.06em;margin-bottom:6px;' }, 'ALGODÃO')];
    if (algEntries.length === 0) algKids.push(el('div', { style: 'font-size:13.5px;color:var(--rv-text-tertiary);' }, '—'));
    for (const a of algEntries) algKids.push(el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;' },
      el('span', { style: 'font-size:13px;font-weight:600;color:var(--rv-text-primary);' }, a.corNome),
      el('span', { style: 'font-size:13px;color:var(--rv-text-primary);font-weight:500;' }, fmt(a.kg))));
    children.push(el('div', { style: 'margin-bottom:14px;' }, algKids));

    children.push(el('div', { style: 'margin-bottom:16px;' },
      el('div', { style: 'font-size:10.5px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.06em;margin-bottom:8px;' }, 'POLIÉSTER'),
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;' },
        el('span', { style: 'font-size:13px;font-weight:600;color:var(--rv-text-primary);' }, 'PRETO'),
        el('span', { style: 'font-size:13px;color:var(--rv-text-primary);font-weight:500;' }, fmt(calc.poliester.PRETO))),
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center;' },
        el('span', { style: 'font-size:13px;font-weight:600;color:var(--rv-text-primary);' }, 'BRANCO'),
        el('span', { style: 'font-size:13px;color:var(--rv-text-primary);font-weight:500;' }, fmt(calc.poliester.BRANCO))),
    ));

    if (semItens) {
      children.push(el('div', { style: 'background:var(--rv-surface-subtle);border:1px solid var(--rv-pill-info-border);border-radius:4px;padding:10px 12px;display:flex;align-items:flex-start;gap:8px;margin-bottom:16px;' },
        svgEl(SVG_INFO),
        el('span', { style: 'font-size:12.5px;color:var(--rv-accent-blue);line-height:1.5;' }, 'Adicione itens para calcular o consumo de fio.')));
    }

    if (!readOnly) {
      children.push(el('div', { style: 'height:1px;background:var(--rv-surface-subtle);margin-bottom:14px;' }));

      const faltamForn = [];
      if (!clienteSel && !hasLinkedPedido()) faltamForn.push('cliente');
      if (!fornSel.cima) faltamForn.push('tecelagem');

      const btnSim = el('button', { type: 'button', style: BTN_SECONDARY + 'margin-bottom:10px;', onclick: salvarSimulacao }, svgEl(SVG_SAVE), 'Salvar simulação');
      const btnAbrir = el('button', {
        type: 'button', style: (faltamForn.length ? BTN_PRIMARY_DISABLED : BTN_PRIMARY) + 'margin-bottom:12px;',
        onclick: () => { if (!faltamForn.length) abrirOP(); },
      }, svgEl(SVG_OPEN), 'Abrir OP');
      if (faltamForn.length) btnAbrir.setAttribute('disabled', 'disabled');
      children.push(btnSim, btnAbrir);

      if (faltamForn.length) {
        children.push(el('div', { style: 'display:flex;align-items:flex-start;gap:7px;' },
          svgEl(SVG_HINT_LOCK),
          el('span', { style: 'font-size:12px;color:var(--rv-text-tertiary);line-height:1.5;' },
            hasLinkedPedido()
              ? 'Selecione o fornecedor de tecelagem para abrir.'
              : 'Escolha cliente e fornecedor de tecelagem para abrir.')));
      }
    }

    rightNode.replaceChildren(...children);
    rightNode._calc = calc;
  }

  render();
  return shellLayout(ADMIN_MENU, container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.opNova = {
    screenNovaOP,
  };

  window.screenNovaOP = screenNovaOP;
})(window);
