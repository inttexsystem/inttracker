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
  var SVG_CHEVRON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
  var SVG_CHEVRON_SM = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
  var SVG_PLUS = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  var SVG_TRASH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';
  var SVG_ICON_OP = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect><line x1="9" y1="12" x2="15" y2="12"></line><line x1="9" y1="16" x2="13" y2="16"></line></svg>';
  var SVG_ICON_GRID = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M3 15h18M9 3v18"></path></svg>';
  var SVG_ICON_LINES = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10H3M21 6H3M21 14H3M21 18H3"></path></svg>';
  var SVG_ICON_ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>';
  var SVG_ICON_SUMMARY = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"></rect><path d="M8 7h8M8 11h8M8 15h5"></path></svg>';
  var SVG_EMPTY_BOX = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#aab2bf" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 7V5a2 2 0 0 0-4 0v2"></path><path d="M8 7V5a2 2 0 0 1 4 0"></path></svg>';
  var SVG_PDF = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
  var SVG_WARNING = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e07b39" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  var SVG_CHECK_SM = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#18794a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  var SVG_INFO = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  var SVG_INFO_BAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  var SVG_UNDO = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6M23 20v-6h-6"></path><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>';
  var SVG_SAVE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>';
  var SVG_OPEN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect></svg>';
  var SVG_HINT_LOCK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';

  var CARD = 'background:#fff;border:1px solid #eceef1;border-radius:6px;';
  var FIELD_LABEL = 'font-size:13px;font-weight:600;color:#3f4757;margin-bottom:7px;display:block;';
  var INPUT_STYLE = 'width:100%;border:1px solid #d8dce2;border-radius:4px;padding:9px 12px;font-size:14px;font-family:inherit;color:#16203a;background:#fff;outline:none;box-sizing:border-box;';
  var SELECT_STYLE = 'width:100%;border:1px solid #d8dce2;border-radius:4px;padding:9px 36px 9px 12px;font-size:14px;font-family:inherit;color:#16203a;background:#fff;outline:none;appearance:none;-webkit-appearance:none;cursor:pointer;box-sizing:border-box;';
  var TH_STYLE = 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.04em;white-space:nowrap;';
  var BTN_OUTLINE = 'display:inline-flex;align-items:center;gap:7px;background:#fff;color:#2563eb;border:1.5px solid #2563eb;border-radius:4px;padding:9px 16px;font-weight:600;font-size:14px;font-family:inherit;cursor:pointer;white-space:nowrap;';
  var BTN_PRIMARY = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;background:#2563eb;color:#fff;border:none;border-radius:4px;padding:12px 16px;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer;';
  var BTN_PRIMARY_DISABLED = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;background:#93b7f5;color:#fff;border:none;border-radius:4px;padding:12px 16px;font-weight:700;font-size:15px;font-family:inherit;cursor:not-allowed;';
  var BTN_SECONDARY = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;background:#fff;color:#2563eb;border:1.5px solid #2563eb;border-radius:4px;padding:10px 16px;font-weight:600;font-size:14px;font-family:inherit;cursor:pointer;';
  var BTN_BACK = 'display:inline-flex;align-items:center;gap:7px;background:#fff;color:#5b6472;border:1px solid #d8dce2;border-radius:4px;padding:8px 16px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;';
  var BTN_SOLID_SM = 'display:inline-flex;align-items:center;background:#2563eb;color:#fff;border:none;border-radius:4px;padding:8px 16px;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer;white-space:nowrap;';
  var BTN_LINK = 'display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#2563eb;background:none;border:none;padding:0;cursor:pointer;font-family:inherit;';
  var SECTION_ICON = 'width:34px;height:34px;border-radius:6px;background:#eaf1fd;display:flex;align-items:center;justify-content:center;flex-shrink:0;';

  function sectionIcon(svgMarkup) {
    return el('div', { style: SECTION_ICON }, svgEl(svgMarkup));
  }
  function sectionHead(svgMarkup, title, extra) {
    var kids = [sectionIcon(svgMarkup), el('span', { style: 'font-size:16px;font-weight:700;color:#16203a;' }, title)];
    if (extra) kids.push(extra);
    return el('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:18px;' }, kids);
  }
  function fieldBlock(label, control, style) {
    return el('div', { style: style || '' }, el('label', { style: FIELD_LABEL }, label), control);
  }
  function selectChevron(small) {
    return el('div', { style: 'position:absolute;right:' + (small ? '10px' : '12px') + ';top:50%;transform:translateY(-50%);pointer-events:none;' },
      svgEl(small ? SVG_CHEVRON_SM : SVG_CHEVRON));
  }
  function wrapSelect(selectNode, small) {
    return el('div', { style: 'position:relative;' }, selectNode, selectChevron(small));
  }
  function styleSelect(sel, extra) {
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
    var cells = labels.map(function (l, i) {
      return el('div', { style: TH_STYLE + (alignLastRight && i === labels.length - 1 ? 'text-align:right;' : '') }, l);
    });
    return el('div', { style: 'display:grid;grid-template-columns:' + colsTemplate + ';gap:10px;padding:10px 24px;background:#f8f9fb;border-bottom:1px solid #eceef1;' }, cells);
  }
  function gridRow(colsTemplate, cells) {
    return el('div', { style: 'display:grid;grid-template-columns:' + colsTemplate + ';gap:10px;padding:12px 24px;border-bottom:1px solid #f1f3f6;align-items:center;' }, cells);
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
  const parametrosByLargura = Object.fromEntries((paramsRes.data || []).map(p => [larguraKey(p.largura), p]));
  const forns = fornsRes.data || [];
  const fornsPorTipo = (tipo) => forns.filter(f => f.tipo === tipo).map(f => ({ value: f.id, label: f.nome }));

  // 2) Estado da tela
  let op = null;                 // OP existente (modo edição/leitura)
  let itens = [];                // [{ modeloId, metros }]
  let fornSel = { fio_algodao: '', fio_poliester: '', cima: '' };
  let clienteSel = '';
  let opItensRaw = [];
  let ordens = [];
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
        el('div', { style: 'font-size:22px;font-weight:800;color:#16203a;letter-spacing:-.01em;' }, 'Pedido não encontrado'),
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
  }

  if (opId) {
    const { data, error } = await supa.from('ops')
      .select('id, numero, ano, status, tipo, observacao, origem_op_id, lote_id, criado_em, lote:lote_id(id, numero, pedido_id, cliente:cliente_id(id, nome)), op_itens(id, modelo_id, metros_pedidos, metros_ajustados, pedido_item_id), op_fornecedores(fornecedor_id, etapa)')
      .eq('id', opId).single();
    if (error || !data) {
      toast('OP não encontrada', 'error'); console.error(error);
      container.replaceChildren(el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:22px;' },
        el('div', { style: 'font-size:22px;font-weight:800;color:#16203a;letter-spacing:-.01em;' }, 'OP não encontrada'),
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
      const ordRes = await supa.from('ordens_compra_fio')
        .select('id, tipo, cor_id, cor_poliester, kg_pedido, kg_recebido, status, cores:cor_id(id, nome)')
        .eq('op_id', op.id);
      if (ordRes.error) { toast('Erro ao carregar ordens de fio', 'error'); console.error(ordRes.error); }
      ordens = ordRes.data || [];
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
      const latexOpsRes = await supa.from('ops').select('id, numero, ano, status, origem_entrega_id').eq('tipo', 'latex').eq('origem_op_id', op.id);
      latexOpPorEntrega = {};
      latexOpInfo = {};
      for (const lo of (latexOpsRes.data || [])) {
        if (!lo.origem_entrega_id) continue;
        latexOpPorEntrega[lo.origem_entrega_id] = lo.id;
        latexOpInfo[lo.origem_entrega_id] = { id: lo.id, numero: lo.numero, ano: lo.ano, status: lo.status };
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
    const { data } = await supa.from('ops').select('numero').eq('ano', ano).order('numero', { ascending: false }).limit(1);
    numero = (data && data[0] ? data[0].numero : 0) + 1;
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

  async function salvarSimulacao() {
    if (saving) return;
    saving = true;
    try {
      const numeroInt = parseInt(numero, 10), anoInt = parseInt(ano, 10);
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
          ops_insert: 'Erro ao salvar OP',
          ops_update: 'Erro ao salvar OP',
          lotes_insert: 'Erro ao criar lote',
          lotes_update: 'Erro ao atualizar lote',
          lotes_vincular: 'Erro ao vincular lote à OP',
          op_itens_delete: 'Erro ao salvar itens',
          op_itens_insert: 'Erro ao salvar itens',
          op_fornecedores_delete: 'Erro ao salvar fornecedor de tecelagem',
          op_fornecedores_insert: 'Erro ao salvar fornecedor de tecelagem',
          ordens_compra_fio_delete: 'Falha ao gerar ordens de compra — OP mantida como simulada',
          ordens_compra_fio_insert: 'Falha ao gerar ordens de compra — OP mantida como simulada',
        };
        toast(mensagens[result.step] || 'Erro ao abrir OP', 'error');
        console.error(result.error);
        return;
      }
      toast('OP aberta — ordens de compra geradas', 'success');
      navigate('#/ops');
    } finally { saving = false; }
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
      });
    }

    const wrap = el('div', {});
    wrap.appendChild(buildHeader());

    const grid = el('div', { style: 'display:grid;grid-template-columns:1fr 288px;gap:16px;align-items:start;' });
    const leftCol = el('div', { style: 'display:flex;flex-direction:column;gap:16px;' });
    leftCol.appendChild(buildCardDados());
    leftCol.appendChild(buildCardItens());
    if (op && op.status !== 'simulada') leftCol.appendChild(buildBlocoFios());
    grid.appendChild(leftCol);
    grid.appendChild(buildRight());
    wrap.appendChild(grid);
    wrap.appendChild(buildBottomInfoBar());
    return wrap;
  }

  function buildHeader() {
    const loteTxt = op && op.lote ? `Lote Nº ${op.lote.numero} · ${op.lote.cliente?.nome || '—'}` : '';
    let titulo = 'Nova OP de Tecelagem';
    let subtitulo = 'Monte a simulacao da tecelagem antes de abrir a OP.';

    if (hasLinkedPedido() && !op) {
      subtitulo = `Pedido Nº ${pedidoCtx.numero} como origem principal. Cliente derivado do pedido.`;
    } else if (isOpAbertaTecelagem()) {
      titulo = `OP Aberta de Tecelagem · Nº ${op.numero}/${op.ano}`;
      subtitulo = hasLinkedPedido()
        ? `Preparacao da OP com Pedido Nº ${pedidoCtx.numero} como origem principal.`
        : 'Preparacao da OP de tecelagem antes da producao.';
    } else if (op) {
      titulo = `OP Nº ${op.numero}/${op.ano}`;
      subtitulo = loteTxt || 'Acompanhamento da OP de tecelagem.';
    }

    const headerLeft = el('div', {},
      el('div', { style: 'font-size:22px;font-weight:800;color:#16203a;letter-spacing:-.01em;' }, titulo),
      el('div', { style: 'font-size:13px;color:#8a93a3;margin-top:3px;line-height:1.45;' }, subtitulo),
    );
    return el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:22px;' },
      headerLeft,
      el('button', { type: 'button', style: BTN_BACK, onclick: () => navigate('#/ops') }, svgEl(SVG_BACK), 'Voltar'),
    );
  }

  function buildBottomInfoBar() {
    let texto = 'Apos abrir a OP, voce podera acompanhar o andamento e gerenciar entregas nas proximas etapas.';
    if (!op) {
      texto = 'Abrir a OP nao inicia a producao — ela fica com status "Aberta" ate a fase futura de transicao.';
    } else if (isOpAbertaTecelagem()) {
      texto = 'Esta OP ja foi aberta e esta em preparacao — a producao nao e iniciada nesta fase.';
    }
    return el('div', { style: 'margin-top:16px;display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #eceef1;border-radius:6px;padding:12px 16px;' },
      svgEl(SVG_INFO_BAR),
      el('span', { style: 'font-size:13px;color:#5b6472;' }, texto),
    );
  }

  function buildCardDados() {
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
      ? el('div', { style: 'margin-bottom:16px;background:#f8f9fb;border:1px solid #eceef1;border-radius:6px;padding:14px 16px;' },
          el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;' },
            el('div', {},
              el('div', { style: 'font-size:12px;font-weight:700;color:#8a93a3;letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px;' }, 'Pedido vinculado'),
              el('div', { style: 'font-size:15px;font-weight:700;color:#16203a;' }, `Pedido Nº ${pedidoCtx.numero}`),
            ),
            el('button', {
              type: 'button',
              style: BTN_LINK + 'white-space:nowrap;',
              onclick: () => navigate('#/pedidos/' + pedidoCtx.id),
            }, 'Abrir pedido'),
          ),
          el('div', { style: 'font-size:12px;font-weight:700;color:#8a93a3;letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px;' }, 'Cliente derivado do pedido'),
          el('div', { style: 'font-size:14px;font-weight:600;color:#16203a;' }, resolveClienteNome()),
          buildPedidoMetaLine()
            ? el('div', { style: 'font-size:12.5px;color:#5b6472;line-height:1.5;margin-top:8px;' }, buildPedidoMetaLine())
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

  function buildCardItens() {
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
        el('span', { style: 'font-size:16px;font-weight:700;color:#16203a;' }, '2. Itens da OP'),
        el('span', { style: 'font-size:13px;color:#8a93a3;font-weight:400;' }, '(modelo × metros)'),
      ),
      !readOnly ? addBtn : '',
    );

    const card = el('div', { style: CARD + 'padding:22px 0 0;' }, header);
    if (hasLinkedPedido()) {
      card.appendChild(el('div', { style: 'padding:0 24px 14px;font-size:12.5px;color:#5b6472;line-height:1.5;' },
        op ? 'Itens mantidos do pedido vinculado para rastreabilidade da OP.' : 'Itens carregados do pedido vinculado como base desta OP.'));
    }

    if (itens.length === 0) {
      card.appendChild(el('div', { style: 'display:grid;grid-template-columns:2fr 1fr 80px;gap:10px;padding:10px 24px;border-top:1px solid #eceef1;border-bottom:1px solid #eceef1;background:#f8f9fb;' },
        el('div', { style: TH_STYLE }, 'MODELO'), el('div', { style: TH_STYLE }, 'METROS'), el('div', { style: TH_STYLE + 'text-align:right;' }, 'AÇÕES')));
      card.appendChild(el('div', { style: 'padding:48px 24px;display:flex;flex-direction:column;align-items:center;gap:10px;' },
        el('div', { style: 'width:48px;height:48px;border-radius:50%;background:#f1f3f6;display:flex;align-items:center;justify-content:center;' }, svgEl(SVG_EMPTY_BOX)),
        el('div', { style: 'font-size:15px;font-weight:700;color:#3f4757;' }, 'Nenhum item adicionado'),
        el('div', { style: 'font-size:13px;color:#8a93a3;' }, 'Adicione ao menos um item para calcular o fio necessário.'),
      ));
    } else {
      card.appendChild(thRow('2fr 1fr 80px', ['MODELO', 'METROS', 'AÇÕES'], { alignLast: 'right' }));
      const rows = el('div', { style: 'padding-bottom:6px;' });
      itens.forEach((item, idx) => rows.appendChild(buildItemRow(item, idx, modeloOptions)));
      card.appendChild(rows);
    }
    return card;
  }

  function buildItemRow(item, idx, modeloOptions) {
    const modeloSel = disabledAttr(readOnly, selectInput({ options: modeloOptions, value: item.modeloId, placeholder: 'Modelo...' }));
    styleSelect(modeloSel, 'padding:7px 30px 7px 10px;font-size:13.5px;');
    modeloSel.addEventListener('change', () => { item.modeloId = modeloSel.value ? Number(modeloSel.value) : ''; renderRight(); });

    const metrosInput = disabledAttr(readOnly, textInput({ type: 'number', value: item.metros === '' ? '' : String(item.metros), placeholder: 'metros' }));
    styleInput(metrosInput, 'padding:7px 10px;font-size:13.5px;');
    metrosInput.addEventListener('input', () => { item.metros = metrosInput.value === '' ? '' : Number(metrosInput.value); renderRight(); });

    const acoes = el('div', { style: 'display:flex;justify-content:flex-end;' });
    if (!readOnly) {
      acoes.appendChild(el('button', {
        type: 'button', style: 'background:none;border:none;cursor:pointer;color:#d6403a;padding:2px;display:inline-flex;',
        onclick: () => { itens.splice(idx, 1); render(); },
      }, svgEl(SVG_TRASH)));
    }

    return el('div', { style: 'display:grid;grid-template-columns:2fr 1fr 80px;gap:10px;padding:9px 24px;align-items:center;border-bottom:1px solid #f1f3f6;' },
      wrapSelect(modeloSel, true), metrosInput, acoes);
  }

  function buildFornField(label, etapa) {
    const fornsTipo = etapa === 'cima' ? fornsPorTipo('tecelagem') : fornsPorTipo(etapa);
    const sel = disabledAttr(readOnly, selectInput({ options: fornsTipo, value: fornSel[etapa], placeholder: 'Selecione o fornecedor...' }));
    styleSelect(sel);
    sel.addEventListener('change', () => { fornSel[etapa] = sel.value ? Number(sel.value) : ''; renderRight(); });
    return fieldBlock(label, wrapSelect(sel));
  }




  async function reloadOrdens() {
    if (!op || op.status === 'simulada') return;
    const r = await supa.from('ordens_compra_fio')
      .select('id, tipo, cor_id, cor_poliester, kg_pedido, kg_recebido, status, cores:cor_id(id, nome)')
      .eq('op_id', op.id);
    if (r.error) { toast('Erro ao recarregar ordens de fio', 'error'); console.error(r.error); return; }
    ordens = r.data || [];
    render();
  }

  function buildOrdemPendenteRow(ordem) {
    const kgInput = textInput({ type: 'number', step: '0.001', value: String(ordem.kg_pedido) });
    styleInput(kgInput, 'width:100px;padding:7px 10px;font-size:13px;');
    const dataInput = textInput({ type: 'date', value: new Date().toISOString().slice(0, 10) });
    styleInput(dataInput, 'width:140px;padding:7px 10px;font-size:13px;');
    const btn = el('button', {
      type: 'button', style: BTN_SOLID_SM,
      onclick: async () => {
        const kg = Number(kgInput.value);
        if (!(kg > 0)) { toast('Informe o kg recebido', 'error'); return; }
        const dataRec = dataInput.value || new Date().toISOString().slice(0, 10);
        const status = kg < Number(ordem.kg_pedido) ? 'recebido_parcial' : 'recebido_total';
        btn.disabled = true;
        const { error } = await window.registrarRecebimentoOrdemFio({
          ordemId: ordem.id,
          kgRecebido: kg,
          dataRecebimento: dataRec,
          status,
        });
        if (error) { toast('Erro ao registrar recebimento', 'error'); console.error(error); btn.disabled = false; return; }
        toast('Recebimento registrado', 'success');
        reloadOrdens();
      }
    }, 'Registrar');

    return el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 24px;border-bottom:1px solid #f1f3f6;' },
      el('div', {},
        el('div', { style: 'font-size:14px;font-weight:600;color:#16203a;' }, window.rotuloFio(ordem)),
        el('div', { style: 'font-size:12px;color:#8a93a3;margin-top:2px;' }, 'Pedido: ' + window.fmtKg(ordem.kg_pedido)),
      ),
      el('div', { style: 'display:flex;align-items:flex-end;gap:10px;flex-shrink:0;' },
        el('div', {}, el('div', { style: 'font-size:11px;font-weight:600;color:#8a93a3;margin-bottom:5px;' }, 'Kg recebido'), kgInput),
        el('div', {}, el('div', { style: 'font-size:11px;font-weight:600;color:#8a93a3;margin-bottom:5px;' }, 'Data'), dataInput),
        btn,
      ),
    );
  }

  function buildBlocoFios() {
    const box = el('div', { style: CARD + 'padding:0;' });
    // Título/ícone dependem do contexto: OP Aberta usa a linguagem de
    // preparação (com ícone, como os demais cards dessa tela); OP Em
    // Produção usa o texto do standalone PROD-OP-TECELAGEM ("3. Insumos
    // — recebimento de fios"), que não usa ícones em nenhum dos 7
    // blocos — confirmado card a card no markup de referência.
    const headerTitulo = op.status === 'aberta' ? '3. Recebimento de fios' : '3. Insumos — recebimento de fios';
    const headerKids = op.status === 'aberta'
      ? [sectionIcon(SVG_ICON_LINES), el('span', { style: 'font-size:16px;font-weight:700;color:#16203a;' }, headerTitulo)]
      : [el('span', { style: 'font-size:16px;font-weight:700;color:#16203a;' }, headerTitulo)];
    box.appendChild(el('div', { style: 'display:flex;align-items:center;gap:10px;padding:20px 24px 16px;' }, headerKids));

    if (ordens.length) {
      box.appendChild(el('div', { style: 'padding:0 24px 16px;' },
        el('button', {
          type: 'button', style: BTN_LINK + 'margin:0;',
          onclick: () => window.gerarPdfCompraFios({ op, ordens }),
        }, svgEl(SVG_PDF), 'PDF de compra de fios')));
    }

    if (op.status === 'aberta') {
      const temAlgodao = ordens.some(o => o.tipo === 'algodao');
      const temPoliester = ordens.some(o => o.tipo === 'poliester');
      const buildAtrib = (label, etapa, tipo, temTipo) => {
        if (!temTipo) return null;
        const sel = selectInput({ options: fornsPorTipo(tipo), value: fioFornSel[etapa], placeholder: 'Selecione...' });
        styleSelect(sel, 'font-size:13px;padding:7px 30px 7px 10px;');
        const btn = el('button', {
          type: 'button', style: BTN_SOLID_SM,
          onclick: async () => {
            const fornecedorId = sel.value ? Number(sel.value) : '';
            if (!fornecedorId) { toast('Selecione um fornecedor.', 'error'); return; }
            const { error } = await window.atribuirFornecedorFioOp({
              opId: op.id,
              etapa,
              tipo,
              fornecedorId,
            });
            if (error) { toast('Erro ao atribuir fornecedor.', 'error'); console.error(error); return; }
            fioFornSel[etapa] = fornecedorId;
            toast('Fornecedor atribuído.', 'success');
            await reloadOrdens();
          }
        }, 'Atribuir');
        return el('div', {},
          el('label', { style: FIELD_LABEL + 'font-size:12px;' }, label),
          el('div', { style: 'display:flex;align-items:center;gap:8px;' },
            el('div', { style: 'flex:1;min-width:0;' }, wrapSelect(sel, true)), btn));
      };
      const a = buildAtrib('Fornecedor de algodão', 'fio_algodao', 'algodao', temAlgodao);
      const p = buildAtrib('Fornecedor de poliéster', 'fio_poliester', 'poliester', temPoliester);
      if (a || p) {
        box.appendChild(el('div', { style: 'padding:0 24px 16px;display:grid;grid-template-columns:1fr 1fr;gap:12px;' }, a || el('div', {}), p || el('div', {})));
      }

      const pendentes = ordens.filter(o => o.status === 'pendente');
      const recebidas = ordens.filter(o => o.status !== 'pendente');

      box.appendChild(el('div', { style: 'padding:10px 24px 6px;border-top:1px solid #eceef1;' },
        el('span', { style: 'font-size:10.5px;font-weight:700;color:#8a93a3;letter-spacing:.06em;' }, 'PENDENTES')));
      if (pendentes.length === 0) {
        box.appendChild(el('div', { style: 'padding:0 24px 16px;font-size:13px;color:#aab2bf;' }, 'Nenhuma ordem pendente.'));
      } else {
        const wrap = el('div', {});
        pendentes.forEach(o => wrap.appendChild(buildOrdemPendenteRow(o)));
        box.appendChild(wrap);
      }

      if (recebidas.length) {
        box.appendChild(el('div', { style: 'padding:14px 24px 0;' },
          el('div', { style: 'font-size:10.5px;font-weight:700;color:#8a93a3;letter-spacing:.06em;margin-bottom:10px;' }, 'RECEBIDAS')));
        box.appendChild(thRow('1fr 140px 140px 120px', ['FIO', 'PEDIDO', 'RECEBIDO', 'STATUS']));
        for (const o of recebidas) {
          box.appendChild(gridRow('1fr 140px 140px 120px', [
            el('div', { style: 'font-size:13.5px;font-weight:500;color:#16203a;' }, window.rotuloFio(o)),
            el('div', { style: 'font-size:13.5px;color:#3f4757;' }, window.fmtKg(o.kg_pedido)),
            el('div', { style: 'font-size:13.5px;color:#3f4757;' }, window.fmtKg(o.kg_recebido)),
            el('div', { style: 'font-size:13px;color:#18794a;font-weight:600;' }, OCF_STATUS_LABEL[o.status] || o.status),
          ]));
        }
      }

      const todasRecebidas = ordens.length > 0 && pendentes.length === 0;
      if (!todasRecebidas) {
        box.appendChild(el('div', { style: 'display:flex;align-items:center;gap:8px;padding:12px 24px;border-top:1px solid #eceef1;background:#fffbf5;' },
          svgEl(SVG_WARNING),
          el('span', { style: 'font-size:12.5px;color:#c2610c;' }, `Aguardando recebimento de ${pendentes.length} fio(s) para calcular a proposta de ajuste.`)));
        return box;
      }
      box.appendChild(buildProposta());
    } else {
      box.appendChild(el('div', { style: 'border-top:1px solid #eceef1;' }));
      box.appendChild(thRow('1fr 140px 140px 120px', ['FIO', 'PEDIDO', 'RECEBIDO', 'STATUS']));
      for (const o of ordens) {
        box.appendChild(gridRow('1fr 140px 140px 120px', [
          el('div', { style: 'font-size:13.5px;font-weight:500;color:#16203a;' }, window.rotuloFio(o)),
          el('div', { style: 'font-size:13.5px;color:#3f4757;' }, window.fmtKg(o.kg_pedido)),
          el('div', { style: 'font-size:13.5px;color:#3f4757;' }, o.kg_recebido == null ? '—' : window.fmtKg(o.kg_recebido)),
          el('div', { style: 'font-size:13px;color:#3f4757;font-weight:600;' }, OCF_STATUS_LABEL[o.status] || o.status),
        ]));
      }

      if (ordens.length > 0 && ordens.every(o => o.status !== 'pendente')) {
        box.appendChild(el('div', { style: 'display:flex;align-items:center;gap:8px;padding:11px 24px;border-top:1px solid #eceef1;background:#fafbfc;' },
          svgEl(SVG_CHECK_SM),
          el('span', { style: 'font-size:12px;color:#5b6472;' }, 'Todos os fios desta OP já foram recebidos.')));
      }

      box.appendChild(el('div', { style: 'padding:16px 24px 0;' },
        el('div', { style: 'font-size:13px;font-weight:700;color:#16203a;margin-bottom:4px;' }, 'Metros de produção')));
      box.appendChild(thRow('1fr 140px 140px', ['MODELO', 'PEDIDO', 'PRODUÇÃO']));
      for (const i of opItensRaw) {
        box.appendChild(gridRow('1fr 140px 140px', [
          el('div', { style: 'font-size:13.5px;font-weight:500;color:#16203a;' }, window.rotuloModelo(modelosById[i.modelo_id])),
          el('div', { style: 'font-size:13.5px;color:#3f4757;' }, window.fmtMetros(i.metros_pedidos)),
          el('div', { style: 'font-size:13.5px;color:#3f4757;' }, i.metros_ajustados == null ? window.fmtMetros(i.metros_pedidos) : window.fmtMetros(i.metros_ajustados)),
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
    const latexOpsRes = await supa.from('ops').select('id, numero, ano, status, origem_entrega_id').eq('tipo', 'latex').eq('origem_op_id', op.id);
    latexOpPorEntrega = {};
    latexOpInfo = {};
    for (const lo of (latexOpsRes.data || [])) {
      if (!lo.origem_entrega_id) continue;
      latexOpPorEntrega[lo.origem_entrega_id] = lo.id;
      latexOpInfo[lo.origem_entrega_id] = { id: lo.id, numero: lo.numero, ano: lo.ano, status: lo.status };
    }
    render();
  }

  // Limite individual de metros de um item assumindo os demais em zero
  // (cada cor consumida pelo item × kg_recebido daquela cor). Usado pra capar o slider.
  // Extraído para js/screens/op-recalculo.js como window.maxMetrosItem.

  function buildProposta() {
    const itensCalc = opItensRaw.map(i => ({ op_item_id: i.id, modelo_id: i.modelo_id, metros_pedidos: Number(i.metros_pedidos) }));
    const resultado = recalcularOP(itensCalc, ordens);

    // Estado editável: metros escolhidos pelo admin por op_item_id.
    // Default = proposta proporcional do fator-gargalo.
    const metrosOverride = {};
    for (const it of resultado.itens) metrosOverride[it.op_item_id] = it.metros_ajustados;

    const wrap = el('div', { style: 'border-top:2px solid #eceef1;padding:18px 24px 0;' });

    const semFio = ordens.some(o => Number(o.kg_recebido) <= 0);
    if (semFio) wrap.appendChild(el('p', { style: 'font-size:13px;color:#d6403a;margin-bottom:8px;' }, 'Atenção: alguma ordem foi recebida com 0 kg.'));

    wrap.appendChild(el('div', { style: 'font-size:13px;color:#3f4757;margin-bottom:2px;' },
      el('strong', {}, 'Fator proporcional (cor mais escassa): '), resultado.fator.toFixed(2).replace('.', ',')));
    wrap.appendChild(el('div', { style: 'font-size:12px;color:#8a93a3;margin-bottom:18px;' },
      'Arraste os sliders abaixo para redistribuir os metros entre os modelos. O consumo de fio é recalculado ao vivo; o botão "Aceitar" trava se alguma cor exceder o recebido.'));

    // Sliders por item ----------------------------------------------------
    const sliders = el('div', {});
    const itemRowState = {};  // { [op_item_id]: { slider, valorLabel } }

    function trackBg(slider) {
      const max = Number(slider.max) || 1;
      const pct = Math.max(0, Math.min(100, (Number(slider.value) / max) * 100));
      return '-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:99px;background:linear-gradient(to right,#2563eb ' + pct + '%,#d8dce2 ' + pct + '%);outline:none;border:none;cursor:pointer;';
    }

    for (const c of itensCalc) {
      const max = Math.max(window.maxMetrosItem(c, modelosById, parametrosByLargura, ordens), c.metros_pedidos);
      const slider = el('input', { type: 'range', min: '0', max: String(max), step: '1' });
      slider.value = String(Math.round(metrosOverride[c.op_item_id]));
      slider.setAttribute('style', trackBg(slider));
      const valorLabel = el('span', { style: 'font-size:13.5px;font-weight:700;color:#16203a;' }, window.fmtMetros(Number(slider.value)));
      slider.addEventListener('input', () => {
        metrosOverride[c.op_item_id] = Number(slider.value);
        valorLabel.textContent = window.fmtMetros(Number(slider.value));
        slider.setAttribute('style', trackBg(slider));
        recompute();
      });

      const modelo = modelosById[c.modelo_id];
      const linha = el('div', { style: 'margin-bottom:18px;' },
        el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;' },
          el('span', { style: 'font-size:13px;font-weight:600;color:#16203a;' }, window.rotuloModelo(modelo) + ' · pedido ' + window.fmtMetros(c.metros_pedidos)),
          valorLabel,
        ),
        slider,
        el('div', { style: 'display:flex;justify-content:space-between;margin-top:4px;' },
          el('span', { style: 'font-size:11px;color:#aab2bf;' }, '0 m'),
          el('span', { style: 'font-size:11px;color:#aab2bf;' }, 'máx individual: ' + window.fmtMetros(max)),
        ),
      );
      sliders.appendChild(linha);
      itemRowState[c.op_item_id] = { slider, valorLabel };
    }
    wrap.appendChild(sliders);

    // Painel de consumo de fio (recomputa a cada movimento) ---------------
    const consumoBox = el('div', { style: 'padding-bottom:16px;' });
    wrap.appendChild(consumoBox);

    const btnReset = el('button', {
      type: 'button', style: BTN_LINK + 'margin-bottom:14px;',
      onclick: () => {
        for (const it of resultado.itens) {
          const v = Math.round(it.metros_ajustados);
          metrosOverride[it.op_item_id] = v;
          const row = itemRowState[it.op_item_id];
          if (row) { row.slider.value = String(v); row.valorLabel.textContent = window.fmtMetros(v); row.slider.setAttribute('style', trackBg(row.slider)); }
        }
        recompute();
      },
    }, svgEl(SVG_UNDO), 'Voltar à proposta proporcional');

    const btnAceitar = el('button', { type: 'button', onclick: () => onAceitar() }, 'Aceitar proposta');
    const btnManter = el('button', {
      type: 'button', style: 'background:#fff;color:#3f4757;border:1px solid #d8dce2;border-radius:4px;padding:10px 20px;font-weight:600;font-size:14px;font-family:inherit;cursor:pointer;',
      onclick: () => aplicarRecalculo(resultado, 'manter'),
    }, 'Manter pedido');

    wrap.appendChild(el('div', { style: 'padding:14px 0 20px;border-top:1px solid #eceef1;margin-top:0;' },
      btnReset,
      el('div', { style: 'display:flex;align-items:center;gap:10px;justify-content:flex-end;' }, btnManter, btnAceitar),
    ));

    function itensComMetrosAtuais() {
      return itensCalc.map(c => ({ op_item_id: c.op_item_id, modelo_id: c.modelo_id, metros: metrosOverride[c.op_item_id] || 0 }));
    }

    function recompute() {
      const consumos = consumoPorOrdem(itensComMetrosAtuais(), ordens, modelosById, parametrosByLargura);
      const algumExcede = consumos.some(c => c.sobra < 0);

      const linhas = [el('div', { style: 'font-size:10.5px;font-weight:700;color:#8a93a3;letter-spacing:.06em;margin-bottom:10px;' }, 'CONSUMO DE FIO')];
      for (const c of consumos) {
        const o = ordens.find(x => x.id === c.ordem_id);
        const nome = o.tipo === 'algodao'
          ? 'Algodão — ' + (o.cores?.nome || '?')
          : 'Poliéster — ' + o.cor_poliester;
        const sobraTxt = c.sobra >= 0
          ? `sobra ${window.fmtKg(c.sobra)}`
          : `EXCEDE em ${window.fmtKg(-c.sobra)}`;
        linhas.push(el('div', { style: 'display:flex;justify-content:space-between;font-size:12.5px;color:' + (c.sobra < 0 ? '#d6403a' : '#3f4757') + ';margin-bottom:6px;' },
          el('span', {}, nome + ': ' + window.fmtKg(c.kg_consumido) + ' / ' + window.fmtKg(c.kg_recebido)),
          el('span', { style: 'font-weight:600;color:' + (c.sobra < 0 ? '#d6403a' : '#18794a') + ';' }, sobraTxt),
        ));
      }
      consumoBox.replaceChildren(...linhas);

      if (algumExcede) {
        btnAceitar.disabled = true;
        btnAceitar.setAttribute('style', 'display:inline-flex;align-items:center;gap:7px;background:#93b7f5;color:#fff;border:none;border-radius:4px;padding:10px 20px;font-weight:700;font-size:14px;font-family:inherit;cursor:not-allowed;');
      } else {
        btnAceitar.disabled = false;
        btnAceitar.setAttribute('style', 'display:inline-flex;align-items:center;gap:7px;background:#2563eb;color:#fff;border:none;border-radius:4px;padding:10px 20px;font-weight:700;font-size:14px;font-family:inherit;cursor:pointer;');
      }
    }

    function onAceitar() {
      const round3 = (n) => Math.round(n * 1000) / 1000;
      const consumos = consumoPorOrdem(itensComMetrosAtuais(), ordens, modelosById, parametrosByLargura);
      if (consumos.some(c => c.sobra < 0)) { toast('Algum fio está excedido — ajuste os sliders', 'error'); return; }
      const itensFinais = itensCalc.map(c => ({
        op_item_id: c.op_item_id,
        metros_pedidos: c.metros_pedidos,
        metros_ajustados: Math.round((metrosOverride[c.op_item_id] || 0) * 100) / 100,
      }));
      const sobrasFinais = consumos
        .filter(c => c.sobra > 0)
        .map(c => {
          const o = ordens.find(x => x.id === c.ordem_id);
          return {
            ordem_id: o.id, tipo: o.tipo,
            cor_id: o.cor_id ?? null, cor_poliester: o.cor_poliester ?? null,
            kg_sobra: round3(c.sobra),
          };
        });
      aplicarRecalculo({ fator: resultado.fator, itens: itensFinais, sobras: sobrasFinais }, 'aceitar');
    }

    recompute();
    return wrap;
  }

  async function aplicarRecalculo(resultado, modo) {
    if (saving) return;
    saving = true;
    try {
      // Writes extraídos para js/screens/op-recalculo.js como
      // window.aplicarRecalculoOP(...). Este caller preserva saving,
      // toast, navigate e console.error.
      const { error, step } = await window.aplicarRecalculoOP({
        opId: op.id,
        resultado,
        modo,
        ordens,
      });

      if (error) {
        const mensagens = {
          op_itens_update: 'Erro ao gravar metros ajustados',
          saldo_fios_op_insert: 'Erro ao gravar saldo da OP — verifique no Supabase',
          saldo_fios_select: 'Erro ao ler saldo total — verifique no Supabase',
          saldo_fios_update: 'Erro ao gravar saldo total — verifique no Supabase',
          saldo_fios_insert: 'Erro ao gravar saldo total — verifique no Supabase',
          ops_update_status: 'Erro ao mudar status — saldo já gravado, verifique no Supabase',
        };
        toast(mensagens[step] || 'Erro ao recalcular OP', 'error');
        console.error(error);
        navigate('#/ops');
        return;
      }

      toast(modo === 'aceitar' ? 'Proposta aceita — produção liberada' : 'Pedido mantido — produção liberada', 'success');
      navigate('#/ops');
    } finally {
      saving = false;
    }
  }

  let rightNode = null;
  function buildRight() {
    rightNode = el('div', { style: CARD + 'padding:20px;' });
    renderRightInto();
    return rightNode;
  }
  function renderRight() { if (rightNode) renderRightInto(); }

  function renderRightInto() {
    let calc;
    try {
      calc = calcularFiosOP(itens, modelosById, parametrosByLargura);
    } catch (err) {
      rightNode.replaceChildren(el('p', { style: 'font-size:13px;color:#d6403a;' }, err.message));
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
        el('div', { style: 'width:40px;height:40px;border-radius:8px;background:#eaf1fd;display:flex;align-items:center;justify-content:center;flex-shrink:0;' }, svgEl(SVG_ICON_SUMMARY)),
        el('div', {},
          el('div', { style: 'font-size:15px;font-weight:700;color:#16203a;' }, 'Resumo da OP'),
          el('span', { style: 'display:inline-block;margin-top:4px;background:#eaf1fd;color:#2563eb;font-size:11.5px;font-weight:600;border-radius:4px;padding:2px 8px;' }, statusLabel),
        ),
      ),
      el('div', { style: 'font-size:13px;color:#5b6472;font-weight:500;margin-bottom:16px;' }, `OP ${numero || '—'}/${ano || '—'}`),
      el('div', { style: 'height:1px;background:#eceef1;margin-bottom:16px;' }),
    ];

    if (hasLinkedPedido()) {
      children.push(
        el('div', { style: 'font-size:10.5px;font-weight:700;color:#8a93a3;letter-spacing:.06em;margin-bottom:6px;' }, 'ORIGEM'),
        el('div', { style: 'font-size:13.5px;font-weight:700;color:#16203a;margin-bottom:4px;' }, `Pedido Nº ${pedidoCtx.numero}`),
        el('div', { style: 'font-size:12.5px;color:#5b6472;margin-bottom:14px;line-height:1.5;' }, 'Cliente derivado do pedido: ' + resolveClienteNome()),
      );
    }

    children.push(el('div', { style: 'font-size:13px;font-weight:700;color:#16203a;margin-bottom:14px;' }, 'Fio necessário'));

    const algEntries = Object.values(calc.algodaoPorCor);
    const algKids = [el('div', { style: 'font-size:10.5px;font-weight:700;color:#8a93a3;letter-spacing:.06em;margin-bottom:6px;' }, 'ALGODÃO')];
    if (algEntries.length === 0) algKids.push(el('div', { style: 'font-size:13.5px;color:#aab2bf;' }, '—'));
    for (const a of algEntries) algKids.push(el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;' },
      el('span', { style: 'font-size:13px;font-weight:600;color:#3f4757;' }, a.corNome),
      el('span', { style: 'font-size:13px;color:#3f4757;font-weight:500;' }, fmt(a.kg))));
    children.push(el('div', { style: 'margin-bottom:14px;' }, algKids));

    children.push(el('div', { style: 'margin-bottom:16px;' },
      el('div', { style: 'font-size:10.5px;font-weight:700;color:#8a93a3;letter-spacing:.06em;margin-bottom:8px;' }, 'POLIÉSTER'),
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;' },
        el('span', { style: 'font-size:13px;font-weight:600;color:#3f4757;' }, 'PRETO'),
        el('span', { style: 'font-size:13px;color:#3f4757;font-weight:500;' }, fmt(calc.poliester.PRETO))),
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center;' },
        el('span', { style: 'font-size:13px;font-weight:600;color:#3f4757;' }, 'BRANCO'),
        el('span', { style: 'font-size:13px;color:#3f4757;font-weight:500;' }, fmt(calc.poliester.BRANCO))),
    ));

    if (semItens) {
      children.push(el('div', { style: 'background:#f6f9ff;border:1px solid #d0e0fb;border-radius:4px;padding:10px 12px;display:flex;align-items:flex-start;gap:8px;margin-bottom:16px;' },
        svgEl(SVG_INFO),
        el('span', { style: 'font-size:12.5px;color:#2563eb;line-height:1.5;' }, 'Adicione itens para calcular o consumo de fio.')));
    }

    if (!readOnly) {
      children.push(el('div', { style: 'height:1px;background:#eceef1;margin-bottom:14px;' }));

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
          el('span', { style: 'font-size:12px;color:#8a93a3;line-height:1.5;' },
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
