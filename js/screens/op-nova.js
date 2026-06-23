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
//      window.rotuloModelo, window.fmtKg, window.fmtMetros,
//      window.disabledAttr, window.rotuloFio, window.OCF_STATUS_LABEL,
//      window.buildEntregaInlineForm, window.salvarEntregaCima,
//      window.atualizarEntregaCima, window.excluirEntrega);
//   - os helpers de UI vindos de js/ui.js e js/badges.js
//     (el, toast, pageHeader, textInput, selectInput, formField,
//      dataTable, modal, confirmDialog, shellLayout, ADMIN_MENU);
//   - os helpers puros vindos de js/calculo-op.js
//     (larguraKey, calcularFiosOP, recalcularOP, consumoPorOrdem,
//      totalEntregueCimaPorItem, agruparOrdensCompraFio);
//   - o cliente Supabase via window.supa (apenas reads);
//   - a geração de PDF via window.jspdf.jsPDF (CDN).
//
// Carregar via <script src="js/screens/op-nova.js"></script> no
// <head>, DEPOIS de js/screens/op-persistir.js e ANTES de jspdf +
// script inline principal. O call-site do inline em setRoutes
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

  async function screenNovaOP(opId) {
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
  let cimaFornecedorId = null;
  let fioFornSel = { fio_algodao: '', fio_poliester: '' };
  let latexOptions = [];
  let numero = '', ano = new Date().getFullYear();
  let readOnly = false;
  let saving = false;

  if (opId) {
    const { data, error } = await supa.from('ops')
      .select('id, numero, ano, status, tipo, observacao, origem_op_id, lote_id, lote:lote_id(id, numero, cliente:cliente_id(id, nome)), op_itens(id, modelo_id, metros_pedidos, metros_ajustados), op_fornecedores(fornecedor_id, etapa)')
      .eq('id', opId).single();
    if (error || !data) {
      toast('OP não encontrada', 'error'); console.error(error);
      container.replaceChildren(pageHeader('OP não encontrada', [{ label: '← Voltar', onclick: () => navigate('#/ops') }]));
      return shellLayout(ADMIN_MENU, container);
    }
    op = data;
    clienteSel = op.lote?.cliente?.id || '';
    if (op.tipo === 'latex') return await window.renderOPLatexAdmin(op.id);
    numero = data.numero; ano = data.ano;
    itens = (data.op_itens || []).map(i => ({ modeloId: i.modelo_id, metros: i.metros_pedidos }));
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
      const latexOpsRes = await supa.from('ops').select('id, origem_entrega_id').eq('tipo', 'latex').eq('origem_op_id', op.id);
      latexOpPorEntrega = {};
      for (const lo of (latexOpsRes.data || [])) if (lo.origem_entrega_id) latexOpPorEntrega[lo.origem_entrega_id] = lo.id;
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
    const loteTxt = op && op.lote ? ` · Lote Nº ${op.lote.numero} · ${op.lote.cliente?.nome || '—'}` : '';
    const titulo = op ? `OP Nº ${op.numero}/${op.ano}${loteTxt}` + (readOnly ? ' (leitura)' : ' (editar)') : 'Nova OP';
    const wrap = el('div', {});
    wrap.appendChild(pageHeader(titulo, [{ label: '← Voltar', onclick: () => navigate('#/ops') }]));

    const grid = el('div', { class: 'flex flex-col lg:flex-row gap-6' });
    grid.appendChild(buildLeft());
    grid.appendChild(buildRight());
    wrap.appendChild(grid);
    if (op && op.status !== 'simulada') wrap.appendChild(buildBlocoFios());
    if (op && op.status !== 'simulada' && cimaFornecedorId) wrap.appendChild(buildBlocoTecelagem());
    return wrap;
  }



  function buildLeft() {
    const left = el('div', { class: 'flex-1 bg-white rounded-xl shadow p-5' });

    const numInput = disabledAttr(readOnly, textInput({ type: 'number', value: String(numero) }));
    const anoInput = disabledAttr(readOnly, textInput({ type: 'number', value: String(ano) }));
    numInput.addEventListener('input', () => { numero = numInput.value; });
    anoInput.addEventListener('input', () => { ano = anoInput.value; });
    const lote = el('div', { class: 'flex gap-3' },
      el('div', { class: 'w-28' }, formField({ label: 'Número', input: numInput })),
      el('div', { class: 'w-28' }, formField({ label: 'Ano', input: anoInput })),
    );
    left.appendChild(lote);

    left.appendChild(el('div', { class: 'font-semibold text-gray-700 mt-2 mb-2' }, 'Itens (modelo × metros)'));
    const itensWrap = el('div', {});
    const modeloOptions = modelos.map(m => ({
      value: m.id,
      label: `${m.nome} ${larguraKey(m.largura)}m · ${m.cor_1?.nome}/${m.cor_2?.nome}`,
    }));
    itens.forEach((item, idx) => itensWrap.appendChild(buildItemRow(item, idx, modeloOptions)));
    left.appendChild(itensWrap);

    if (!readOnly) {
      left.appendChild(el('button', {
        class: 'mt-2 text-sm text-blue-700 hover:underline',
        onclick: () => { itens.push({ modeloId: '', metros: '' }); render(); }
      }, '+ adicionar item'));
    }

    left.appendChild(el('div', { class: 'font-semibold text-gray-700 mt-5 mb-2' }, 'Cliente'));
    const clienteSelEl = disabledAttr(readOnly, selectInput({ options: clientesOptions, value: clienteSel, placeholder: 'Selecione o cliente...' }));
    clienteSelEl.addEventListener('change', () => { clienteSel = clienteSelEl.value ? Number(clienteSelEl.value) : ''; renderRight(); });
    left.appendChild(formField({ label: 'Cliente', input: clienteSelEl }));

    left.appendChild(el('div', { class: 'font-semibold text-gray-700 mt-5 mb-2' }, 'Fornecedor de tecelagem'));
    left.appendChild(buildFornField('Tecelagem (parte de cima)', 'cima'));

    return left;
  }

  function buildItemRow(item, idx, modeloOptions) {
    const modeloSel = disabledAttr(readOnly, selectInput({ options: modeloOptions, value: item.modeloId, placeholder: 'Modelo...' }));
    const metrosInput = disabledAttr(readOnly, textInput({ type: 'number', value: item.metros === '' ? '' : String(item.metros), placeholder: 'metros' }));
    modeloSel.addEventListener('change', () => { item.modeloId = modeloSel.value ? Number(modeloSel.value) : ''; renderRight(); });
    metrosInput.addEventListener('input', () => { item.metros = metrosInput.value === '' ? '' : Number(metrosInput.value); renderRight(); });

    const row = el('div', { class: 'flex gap-2 items-center mb-2' },
      el('div', { class: 'flex-1' }, modeloSel),
      el('div', { class: 'w-24' }, metrosInput),
    );
    if (!readOnly) {
      row.appendChild(el('button', { class: 'text-red-600 hover:underline text-sm', onclick: () => { itens.splice(idx, 1); render(); } }, '✕'));
    }
    return row;
  }

  function buildFornField(label, etapa) {
    const fornsTipo = etapa === 'cima' ? fornsPorTipo('tecelagem') : fornsPorTipo(etapa);
    const sel = disabledAttr(readOnly, selectInput({ options: fornsTipo, value: fornSel[etapa], placeholder: 'Selecione...' }));
    sel.addEventListener('change', () => { fornSel[etapa] = sel.value ? Number(sel.value) : ''; renderRight(); });
    return formField({ label, input: sel });
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
    const dataInput = textInput({ type: 'date', value: new Date().toISOString().slice(0, 10) });
    const btn = el('button', {
      class: 'bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg px-3 py-2',
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

    return el('div', { class: 'flex flex-wrap items-end gap-3 border-b py-3' },
      el('div', { class: 'flex-1 min-w-[200px]' },
        el('div', { class: 'font-medium text-gray-800' }, window.rotuloFio(ordem)),
        el('div', { class: 'text-xs text-gray-500' }, 'Pedido: ' + window.fmtKg(ordem.kg_pedido)),
      ),
      el('div', { class: 'w-32' }, formField({ label: 'Kg recebido', input: kgInput })),
      el('div', { class: 'w-40' }, formField({ label: 'Data', input: dataInput })),
      btn,
    );
  }

  function gerarPdfCompraFios() {
    const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor) { toast('Biblioteca de PDF não carregou', 'error'); return; }
    const g = agruparOrdensCompraFio(ordens);
    const doc = new jsPDFCtor();
    const loteTxt = op.lote ? `Lote Nº ${op.lote.numero} · ${op.lote.cliente?.nome || '—'}` : 'Lote —';
    let y = 15;
    doc.setFontSize(14); doc.text('Compra de fios', 14, y); y += 8;
    doc.setFontSize(10);
    doc.text(`${loteTxt}`, 14, y); y += 6;
    doc.text(`OP Nº ${op.numero}/${op.ano} · ${new Date().toLocaleDateString('pt-BR')}`, 14, y); y += 10;

    const secao = (titulo, lista, total) => {
      doc.setFontSize(12); doc.text(titulo, 14, y); y += 6;
      doc.setFontSize(10);
      if (lista.length === 0) { doc.text('—', 18, y); y += 6; }
      for (const it of lista) {
        doc.text(`${it.rotulo}`, 18, y);
        doc.text(`${it.kg.toFixed(3).replace('.', ',')} kg`, 120, y);
        y += 6;
      }
      doc.setFont(undefined, 'bold');
      doc.text(`Total ${titulo}: ${total.toFixed(3).replace('.', ',')} kg`, 18, y);
      doc.setFont(undefined, 'normal');
      y += 10;
    };
    secao('Algodão', g.algodao, g.totalAlgodao);
    secao('Poliéster', g.poliester, g.totalPoliester);

    doc.save(`compra-fios-OP-${op.numero}-${op.ano}.pdf`);
  }

  function buildBlocoFios() {
    const box = el('div', { class: 'bg-white rounded-xl shadow p-5 mt-6' });
    box.appendChild(el('div', { class: 'font-semibold text-gray-700 mb-3' }, 'Recebimento de fios'));

    if (ordens.length) {
      box.appendChild(el('button', {
        class: 'mb-3 text-sm text-blue-700 hover:underline',
        onclick: () => gerarPdfCompraFios(),
      }, '📄 PDF de compra de fios'));
    }

    if (op.status === 'aberta') {
      const temAlgodao = ordens.some(o => o.tipo === 'algodao');
      const temPoliester = ordens.some(o => o.tipo === 'poliester');
      const atribRow = el('div', { class: 'flex flex-wrap gap-4 mb-4' });
      const buildAtrib = (label, etapa, tipo, temTipo) => {
        if (!temTipo) return null;
        const sel = selectInput({ options: fornsPorTipo(tipo), value: fioFornSel[etapa], placeholder: 'Selecione...' });
        const btn = el('button', { class: 'bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg px-3 py-2',
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
          } }, 'Atribuir');
        return el('div', { class: 'flex items-end gap-2' },
          el('div', { class: 'w-48' }, formField({ label, input: sel })), btn);
      };
      const a = buildAtrib('Fornecedor de algodão', 'fio_algodao', 'algodao', temAlgodao);
      const p = buildAtrib('Fornecedor de poliéster', 'fio_poliester', 'poliester', temPoliester);
      if (a) atribRow.appendChild(a);
      if (p) atribRow.appendChild(p);
      if (a || p) box.appendChild(atribRow);

      const pendentes = ordens.filter(o => o.status === 'pendente');
      const recebidas = ordens.filter(o => o.status !== 'pendente');

      box.appendChild(el('div', { class: 'text-xs uppercase text-gray-500 mb-1' }, 'Pendentes'));
      if (pendentes.length === 0) {
        box.appendChild(el('p', { class: 'text-sm text-gray-400 mb-3' }, 'Nenhuma ordem pendente.'));
      } else {
        box.appendChild(el('div', { class: 'mb-3' }, pendentes.map(buildOrdemPendenteRow)));
      }

      if (recebidas.length) {
        box.appendChild(el('div', { class: 'text-xs uppercase text-gray-500 mt-2 mb-1' }, 'Recebidas'));
        box.appendChild(dataTable({
          columns: [
            { key: 'fio', label: 'Fio', render: window.rotuloFio },
            { key: 'kg_pedido', label: 'Pedido', render: (o) => window.fmtKg(o.kg_pedido) },
            { key: 'kg_recebido', label: 'Recebido', render: (o) => window.fmtKg(o.kg_recebido) },
            { key: 'status', label: 'Status', render: (o) => OCF_STATUS_LABEL[o.status] || o.status },
          ],
          rows: recebidas,
        }));
      }

      const todasRecebidas = ordens.length > 0 && pendentes.length === 0;
      if (!todasRecebidas) {
        box.appendChild(el('p', { class: 'text-sm text-amber-700 mt-3' },
          `Aguardando recebimento de ${pendentes.length} fio(s) para calcular a proposta de ajuste.`));
        return box;
      }
      box.appendChild(buildProposta());
    } else {
      box.appendChild(dataTable({
        columns: [
          { key: 'fio', label: 'Fio', render: window.rotuloFio },
          { key: 'kg_pedido', label: 'Pedido', render: (o) => window.fmtKg(o.kg_pedido) },
          { key: 'kg_recebido', label: 'Recebido', render: (o) => o.kg_recebido == null ? '—' : window.fmtKg(o.kg_recebido) },
          { key: 'status', label: 'Status', render: (o) => OCF_STATUS_LABEL[o.status] || o.status },
        ],
        rows: ordens,
      }));

      box.appendChild(el('div', { class: 'font-semibold text-gray-700 mt-4 mb-2' }, 'Metros de produção'));
      box.appendChild(dataTable({
        columns: [
          { key: 'modelo', label: 'Modelo', render: (i) => window.rotuloModelo(modelosById[i.modelo_id]) },
          { key: 'metros_pedidos', label: 'Pedido', render: (i) => window.fmtMetros(i.metros_pedidos) },
          { key: 'metros_ajustados', label: 'Produção', render: (i) => i.metros_ajustados == null ? window.fmtMetros(i.metros_pedidos) : window.fmtMetros(i.metros_ajustados) },
        ],
        rows: opItensRaw,
      }));
    }
    return box;
  }

  function buildBlocoTecelagem() {
    const box = el('div', { class: 'bg-white rounded-xl shadow p-5 mt-6' });
    box.appendChild(el('div', { class: 'font-semibold text-gray-700 mb-3' }, 'Entregas tecelagem'));

    const todosItens = entregasCima.flatMap(e => (e.entrega_itens || []).filter(ei => ei.op_id === op.id));
    const totalPorItem = totalEntregueCimaPorItem(todosItens);

    box.appendChild(dataTable({
      columns: [
        { key: 'modelo', label: 'Modelo', render: (i) => window.rotuloModelo(modelosById[i.modelo_id]) },
        { key: 'metros_pedidos', label: 'Pedido', render: (i) => window.fmtMetros(i.metros_pedidos) },
        { key: 'metros_ajustados', label: 'Ajustado', render: (i) => i.metros_ajustados == null ? window.fmtMetros(i.metros_pedidos) : window.fmtMetros(i.metros_ajustados) },
        { key: 'entregue', label: 'Entregue', render: (i) => window.fmtMetros(totalPorItem[i.id] || 0) },
        { key: 'falta', label: 'Falta', render: (i) => {
            const ajustado = i.metros_ajustados == null ? Number(i.metros_pedidos) : Number(i.metros_ajustados);
            const falta = Math.round((ajustado - (totalPorItem[i.id] || 0)) * 100) / 100;
            const cor = falta <= 0 ? 'text-green-700' : 'text-gray-800';
            return el('span', { class: cor }, falta <= 0 ? '✅ completo' : window.fmtMetros(falta));
          } },
      ],
      rows: opItensRaw,
    }));

    if (op.status === 'em_producao') {
      const formHolder = el('div', {});
      const btnNova = el('button', {
        class: 'mt-3 text-sm text-blue-700 hover:underline',
        onclick: () => {
          const form = buildEntregaInlineForm({ opItens: opItensRaw, modelosById, latexOptions });
          const btnSalvar = el('button', {
            class: 'bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg px-3 py-2 mr-2',
            onclick: async () => {
              btnSalvar.disabled = true;
              const ok = await salvarEntregaCima({ fornecedorId: cimaFornecedorId, opId: op.id, payload: form.getPayload() });
              btnSalvar.disabled = false;
              if (ok) reloadEntregasCima();
            },
          }, 'Salvar entrega');
          const btnCancelar = el('button', {
            class: 'bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold rounded-lg px-3 py-2',
            onclick: () => { formHolder.replaceChildren(); btnNova.style.display = ''; },
          }, 'Cancelar');
          formHolder.replaceChildren(el('div', {}, form.node, el('div', { class: 'mt-2' }, btnSalvar, btnCancelar)));
          btnNova.style.display = 'none';
        },
      }, '+ Nova entrega');
      box.appendChild(btnNova);
      box.appendChild(formHolder);
    }

    box.appendChild(el('div', { class: 'font-semibold text-gray-700 mt-5 mb-2' }, 'Histórico'));
    if (entregasCima.length === 0) {
      box.appendChild(el('p', { class: 'text-sm text-gray-400' }, 'Nenhuma entrega registrada ainda.'));
    } else {
      for (const ent of entregasCima) {
        const subcard = el('div', { class: 'border-b py-3' });
        subcard.appendChild(el('div', { class: 'flex items-center justify-between' },
          el('div', { class: 'text-sm' },
            el('b', {}, new Date(ent.data + 'T00:00:00').toLocaleDateString('pt-BR')),
            ' · ' + (ent.fornecedores?.nome || '?'),
            ent.destino?.nome ? ' → látex: ' + ent.destino.nome : '',
          ),
          op.status === 'em_producao' ? el('div', {},
            el('button', { class: 'text-sm text-blue-700 hover:underline mr-3',
              onclick: () => abrirEdicaoAdmin(ent) }, 'Editar'),
            el('button', { class: 'text-sm text-red-600 hover:underline',
              onclick: () => excluirEntrega(ent.id, reloadEntregasCima) }, 'Excluir'),
            latexOpPorEntrega[ent.id] ? el('button', { class: 'text-sm text-amber-700 hover:underline ml-3',
              onclick: () => navigate('#/ops/' + latexOpPorEntrega[ent.id]) }, 'Ver OP de látex') : '',
          ) : '',
        ));
        if (ent.observacao) subcard.appendChild(el('div', { class: 'text-xs text-gray-500' }, ent.observacao));
        for (const ei of (ent.entrega_itens || []).filter(x => x.op_id === op.id)) {
          const it = opItensRaw.find(i => i.id === ei.op_item_id);
          const nome = it ? window.rotuloModelo(modelosById[it.modelo_id]) : '?';
          subcard.appendChild(el('div', { class: 'text-sm text-gray-700' },
            nome + ': ' + window.fmtMetros(ei.metros_entregues),
            ei.defeito ? el('span', { class: 'ml-2 text-red-600 font-semibold' }, '⚠ DEFEITO') : '',
            ei.observacao ? el('span', { class: 'ml-2 text-xs text-gray-500' }, '(' + ei.observacao + ')') : '',
          ));
        }
        box.appendChild(subcard);
      }
    }
    return box;
  }

  function abrirEdicaoAdmin(entrega) {
    const form = buildEntregaInlineForm({ opItens: opItensRaw, modelosById, entrega, latexOptions });
    modal({
      title: `Editar entrega — ${new Date(entrega.data + 'T00:00:00').toLocaleDateString('pt-BR')}`,
      body: form.node,
      saveLabel: 'Salvar alterações',
      onSave: async () => {
        const ok = await atualizarEntregaCima({ entregaId: entrega.id, opId: op.id, payload: form.getPayload() });
        if (ok) reloadEntregasCima();
        return ok;
      },
    });
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
    const latexOpsRes = await supa.from('ops').select('id, origem_entrega_id').eq('tipo', 'latex').eq('origem_op_id', op.id);
    latexOpPorEntrega = {};
    for (const lo of (latexOpsRes.data || [])) if (lo.origem_entrega_id) latexOpPorEntrega[lo.origem_entrega_id] = lo.id;
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

    const wrap = el('div', { class: 'mt-4' });

    const semFio = ordens.some(o => Number(o.kg_recebido) <= 0);
    if (semFio) wrap.appendChild(el('p', { class: 'text-sm text-red-600 mb-2' }, 'Atenção: alguma ordem foi recebida com 0 kg.'));

    wrap.appendChild(el('p', { class: 'text-sm text-gray-700 mb-2' },
      'Fator proporcional (cor mais escassa): ', el('b', {}, resultado.fator.toFixed(2).replace('.', ','))));
    wrap.appendChild(el('p', { class: 'text-xs text-gray-500 mb-3' },
      'Arraste os sliders abaixo para redistribuir os metros entre os modelos. O consumo de fio é recalculado ao vivo; o botão "Aceitar" trava se alguma cor exceder o recebido.'));

    // Sliders por item ----------------------------------------------------
    const sliders = el('div', { class: 'space-y-3 mb-4' });
    const itemRowState = {};  // { [op_item_id]: { slider, valorLabel } }

    for (const c of itensCalc) {
      const max = Math.max(window.maxMetrosItem(c, modelosById, parametrosByLargura, ordens), c.metros_pedidos);
      const slider = el('input', {
        type: 'range', min: '0', max: String(max), step: '1',
        class: 'w-full',
      });
      slider.value = String(Math.round(metrosOverride[c.op_item_id]));
      const valorLabel = el('span', { class: 'text-sm font-semibold text-gray-800 w-20 text-right' }, window.fmtMetros(Number(slider.value)));
      slider.addEventListener('input', () => {
        metrosOverride[c.op_item_id] = Number(slider.value);
        valorLabel.textContent = window.fmtMetros(Number(slider.value));
        recompute();
      });

      const modelo = modelosById[c.modelo_id];
      const linha = el('div', { class: 'border rounded-lg p-3' },
        el('div', { class: 'flex items-center justify-between mb-1' },
          el('div', { class: 'text-sm font-medium text-gray-800' }, window.rotuloModelo(modelo) + '  ·  pedido ' + window.fmtMetros(c.metros_pedidos)),
          valorLabel,
        ),
        slider,
        el('div', { class: 'flex justify-between text-xs text-gray-400 mt-1' },
          el('span', {}, '0 m'),
          el('span', {}, 'máx individual: ' + window.fmtMetros(max)),
        ),
      );
      sliders.appendChild(linha);
      itemRowState[c.op_item_id] = { slider, valorLabel };
    }
    wrap.appendChild(sliders);

    // Painel de consumo de fio (recomputa a cada movimento) ---------------
    const consumoBox = el('div', { class: 'bg-gray-50 rounded-lg p-3 mb-3' });
    wrap.appendChild(consumoBox);

    const btnReset = el('button', {
      class: 'text-sm text-blue-700 hover:underline mb-3',
      onclick: () => {
        for (const it of resultado.itens) {
          const v = Math.round(it.metros_ajustados);
          metrosOverride[it.op_item_id] = v;
          const row = itemRowState[it.op_item_id];
          if (row) { row.slider.value = String(v); row.valorLabel.textContent = window.fmtMetros(v); }
        }
        recompute();
      },
    }, '↺ Voltar à proposta proporcional');
    wrap.appendChild(btnReset);

    const btnAceitar = el('button', {
      class: 'font-semibold rounded-lg px-4 py-2 mt-4 mr-2',
      onclick: () => onAceitar(),
    }, 'Aceitar proposta');
    const btnManter = el('button', {
      class: 'bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg px-4 py-2 mt-4',
      onclick: () => aplicarRecalculo(resultado, 'manter'),
    }, 'Manter pedido');
    wrap.appendChild(el('div', {}, btnAceitar, btnManter));

    function itensComMetrosAtuais() {
      return itensCalc.map(c => ({ op_item_id: c.op_item_id, modelo_id: c.modelo_id, metros: metrosOverride[c.op_item_id] || 0 }));
    }

    function recompute() {
      const consumos = consumoPorOrdem(itensComMetrosAtuais(), ordens, modelosById, parametrosByLargura);
      const algumExcede = consumos.some(c => c.sobra < 0);

      const linhas = [el('div', { class: 'text-xs uppercase text-gray-500 mb-2' }, 'Consumo de fio')];
      for (const c of consumos) {
        const o = ordens.find(x => x.id === c.ordem_id);
        const nome = o.tipo === 'algodao'
          ? 'Algodão — ' + (o.cores?.nome || '?')
          : 'Poliéster — ' + o.cor_poliester;
        const sobraTxt = c.sobra >= 0
          ? `sobra ${window.fmtKg(c.sobra)}`
          : `EXCEDE em ${window.fmtKg(-c.sobra)}`;
        linhas.push(el('div', { class: 'flex justify-between text-sm py-1 ' + (c.sobra < 0 ? 'text-red-600' : 'text-gray-700') },
          el('span', {}, nome + ': ' + window.fmtKg(c.kg_consumido) + ' / ' + window.fmtKg(c.kg_recebido)),
          el('span', { class: 'font-medium' }, sobraTxt),
        ));
      }
      consumoBox.replaceChildren(...linhas);

      if (algumExcede) {
        btnAceitar.disabled = true;
        btnAceitar.className = 'font-semibold rounded-lg px-4 py-2 mt-4 mr-2 bg-blue-300 text-white cursor-not-allowed';
      } else {
        btnAceitar.disabled = false;
        btnAceitar.className = 'font-semibold rounded-lg px-4 py-2 mt-4 mr-2 bg-blue-700 hover:bg-blue-800 text-white';
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
    rightNode = el('div', { class: 'lg:w-80 bg-gray-50 rounded-xl shadow p-5 self-start' });
    renderRightInto();
    return rightNode;
  }
  function renderRight() { if (rightNode) renderRightInto(); }

  function renderRightInto() {
    let calc;
    try {
      calc = calcularFiosOP(itens, modelosById, parametrosByLargura);
    } catch (err) {
      rightNode.replaceChildren(el('p', { class: 'text-red-600 text-sm' }, err.message));
      return;
    }
    const fmt = (n) => Number(n).toFixed(3).replace('.', ',') + ' kg';
    const children = [el('div', { class: 'font-semibold text-gray-700 mb-3' }, 'Fio necessário')];

    const algEntries = Object.values(calc.algodaoPorCor);
    children.push(el('div', { class: 'text-xs uppercase text-gray-500 mb-1' }, 'Algodão'));
    if (algEntries.length === 0) children.push(el('p', { class: 'text-sm text-gray-400 mb-2' }, '—'));
    for (const a of algEntries) children.push(el('p', { class: 'text-sm mb-1' }, `${a.corNome}: `, el('b', {}, fmt(a.kg))));

    children.push(el('div', { class: 'text-xs uppercase text-gray-500 mt-3 mb-1' }, 'Poliéster'));
    children.push(el('p', { class: 'text-sm mb-1' }, 'PRETO: ', el('b', {}, fmt(calc.poliester.PRETO))));
    children.push(el('p', { class: 'text-sm mb-1' }, 'BRANCO: ', el('b', {}, fmt(calc.poliester.BRANCO))));

    if (!readOnly) {
      const faltamForn = [];
      if (!clienteSel) faltamForn.push('cliente');
      if (!fornSel.cima) faltamForn.push('tecelagem');
      const btnSim = el('button', {
        class: 'w-full mt-5 mb-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg py-2',
        onclick: salvarSimulacao,
      }, 'Salvar simulação');
      const btnAbrir = el('button', {
        class: 'w-full font-semibold rounded-lg py-2 ' + (faltamForn.length
          ? 'bg-blue-300 text-white cursor-not-allowed'
          : 'bg-blue-700 hover:bg-blue-800 text-white'),
        onclick: () => { if (!faltamForn.length) abrirOP(); },
      }, 'Abrir OP');
      if (faltamForn.length) btnAbrir.setAttribute('disabled', 'disabled');
      children.push(btnSim, btnAbrir);
      if (faltamForn.length) children.push(el('p', { class: 'text-xs text-gray-500 mt-1' }, 'Escolha cliente e fornecedor de tecelagem para abrir.'));
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
