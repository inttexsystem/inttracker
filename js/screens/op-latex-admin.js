// =====================================================================
// === SCREENS: OP LATEX ADMIN (Seam A) =================================
// Tela de admin de OP de látex (recebimento de látex pelo fornecedor
// da etapa de látex). Esta tela é ativada quando screenNovaOP detecta
// que a OP é do tipo 'latex', retornando o resultado de
// renderOPLatexAdmin(op.id) em vez de renderizar o form de tecelagem.
//
// Extraída do <script> inline de index.html sem alterar
// comportamento, lógica de writes internos, ordem de chamada ou
// semântica dos toasts/confirmações.
//
// Carregar via <script src="js/screens/op-latex-admin.js"></script>
// no <head>, DEPOIS de js/screens/op-writes.js e ANTES de jspdf +
// script inline principal. A tela inline (screenNovaOP) referencia
// esta função com prefixo `window.` (call-site explícito).
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.el, window.toast, window.pageHeader, window.dataTable,
//     window.formField, window.textInput, window.modal,
//     window.confirmDialog                            (js/ui.js)
//   - window.shellLayout, window.ADMIN_MENU            (js/screens/common.js)
//   - window.navigate                                  (js/router.js)
//   - window.supa                                      (js/supabase-client.js)
//   - window.badgeTipo, window.badgeStatus             (js/badges.js)
//   - window.larguraKey,
//     window.totalEntregueCimaPorItem                  (js/calculo-op.js)
//   - window.rotuloModelo, window.fmtMetros            (js/screens/op-form-helpers.js)
//   - window.buildEntregaInlineForm                    (js/screens/entrega-form.js)
//   - window.salvarEntregaLatex,
//     window.atualizarEntregaLatex,
//     window.excluirEntrega                            (js/screens/entrega-writes.js)
//
// NÃO depende de: window.CURRENT_USER, window.registrarRecebimentoOrdemFio,
// window.atribuirFornecedorFioOp. NÃO faz rpc.
//
// Compatibilidade: window.renderOPLatexAdmin segue disponível
// para o call-site do inline em screenNovaOP.
// =====================================================================

(function (window) {
  'use strict';

  async function renderOPLatexAdmin(opId) {
    const container = el('div', {});


    async function reload() {
      const opRes = await supa.from('ops')
        .select('id, numero, ano, status, tipo, observacao, origem_op_id, lote:lote_id(numero, cliente:cliente_id(nome)), op_itens(id, modelo_id, metros_pedidos), op_fornecedores(fornecedor_id, etapa, fornecedores:fornecedor_id(nome))')
        .eq('id', opId).single();
      if (opRes.error) { toast('Erro ao carregar OP de látex', 'error'); console.error(opRes.error); return; }
      const op = opRes.data;
      const latexForn = (op.op_fornecedores || []).find(f => f.etapa === 'latex');
      const latexFornecedorId = latexForn ? latexForn.fornecedor_id : null;

      const entRes = await supa.from('entregas')
        .select('id, fornecedor_id, data, observacao, entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
        .eq('etapa', 'latex').eq('fornecedor_id', latexFornecedorId)
        .order('data', { ascending: false }).order('id', { ascending: false });
      const recebimentos = (entRes.data || []).filter(e => (e.entrega_itens || []).some(ei => ei.op_id === op.id));

      const modeloIds = [...new Set((op.op_itens || []).map(i => i.modelo_id))];
      const modelosRes = modeloIds.length
        ? await supa.from('modelos').select('id, nome, largura, cor_1:cor_1_id(id,nome), cor_2:cor_2_id(id,nome)').in('id', modeloIds)
        : { data: [] };
      const modelosById = {};
      for (const m of (modelosRes.data || [])) modelosById[m.id] = m;

      render(op, recebimentos, modelosById, latexFornecedorId);
    }

    function render(op, recebimentos, modelosById, latexFornecedorId) {
      const recItens = recebimentos.flatMap(e => (e.entrega_itens || []).filter(ei => ei.op_id === op.id));
      const totalPorItem = totalEntregueCimaPorItem(recItens);

      const acoes = [{ label: '← Voltar', onclick: () => navigate('#/ops') }];
      if (op.origem_op_id) acoes.push({ label: 'Ir para OP de tecelagem', onclick: () => navigate('#/ops/' + op.origem_op_id) });
      if (op.status === 'em_producao') acoes.push({ label: 'Finalizar OP de látex', onclick: () => finalizar(op.id) });
      if (op.status === 'em_producao') acoes.push({ label: 'Editar enviado', onclick: () => editarEnviado(op, modelosById) });
      acoes.push({ label: 'Excluir OP de látex', onclick: () => excluirOpLatex(op.id) });
      const header = pageHeader(`OP de látex Nº ${op.numero}/${op.ano}`, acoes);

      const info = el('div', { class: 'bg-white rounded-xl shadow p-5 mb-4' },
        el('div', { class: 'flex items-center gap-3 mb-2' }, badgeTipo('latex'), badgeStatus(op.status)),
        op.lote ? el('div', { class: 'text-sm text-gray-700 mb-1' }, `Lote Nº ${op.lote.numero} · ${op.lote.cliente?.nome || '—'}`) : el('span', {}),
        op.observacao ? el('div', { class: 'text-sm text-gray-600' }, op.observacao) : el('span', {}),
      );

      const tabela = dataTable({
        columns: [
          { key: 'modelo', label: 'Modelo', render: (i) => {
              const m = modelosById[i.modelo_id];
              return m ? window.rotuloModelo(m) : ('#' + i.modelo_id);
            } },
          { key: 'enviado', label: 'Enviado', render: (i) => window.fmtMetros(i.metros_pedidos) },
          { key: 'recebido', label: 'Recebido', render: (i) => window.fmtMetros(totalPorItem[i.id] || 0) },
          { key: 'falta', label: 'Falta', render: (i) => {
              const falta = Math.round((Number(i.metros_pedidos) - (totalPorItem[i.id] || 0)) * 100) / 100;
              return el('span', { class: falta <= 0 ? 'text-green-700' : 'text-gray-800' }, falta <= 0 ? '✅ completo' : window.fmtMetros(falta));
            } },
        ],
        rows: op.op_itens || [],
      });

      const box = el('div', { class: 'bg-white rounded-xl shadow p-5' });
      box.appendChild(el('div', { class: 'font-semibold text-gray-700 mb-3' }, 'Recebimentos'));

      if (op.status === 'em_producao' && latexFornecedorId) {
        const formHolder = el('div', {});
        const btnNova = el('button', { class: 'text-sm text-blue-700 hover:underline mb-2',
          onclick: () => {
            const form = buildEntregaInlineForm({ opItens: op.op_itens || [], modelosById, comDestino: false });
            const btnSalvar = el('button', { class: 'bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg px-3 py-2 mr-2',
              onclick: async () => { btnSalvar.disabled = true;
                const ok = await salvarEntregaLatex({ fornecedorId: latexFornecedorId, opId: op.id, payload: form.getPayload() });
                btnSalvar.disabled = false; if (ok) reload(); } }, 'Salvar recebimento');
            const btnCancelar = el('button', { class: 'bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold rounded-lg px-3 py-2',
              onclick: () => { formHolder.replaceChildren(); btnNova.style.display = ''; } }, 'Cancelar');
            formHolder.replaceChildren(el('div', {}, form.node, el('div', { class: 'mt-2' }, btnSalvar, btnCancelar)));
            btnNova.style.display = 'none';
          } }, '+ Novo recebimento');
        box.appendChild(btnNova);
        box.appendChild(formHolder);
      }

      if (recebimentos.length === 0) {
        box.appendChild(el('p', { class: 'text-sm text-gray-400 mt-2' }, 'Nenhum recebimento registrado ainda.'));
      } else {
        for (const ent of recebimentos) {
          const sub = el('div', { class: 'border-b py-3' });
          sub.appendChild(el('div', { class: 'flex items-center justify-between' },
            el('div', { class: 'text-sm' }, el('b', {}, new Date(ent.data + 'T00:00:00').toLocaleDateString('pt-BR'))),
            op.status === 'em_producao' ? el('div', {},
              el('button', { class: 'text-sm text-blue-700 hover:underline mr-3',
                onclick: () => abrirEdicaoAdmin(ent, op, modelosById) }, 'Editar'),
              el('button', { class: 'text-sm text-red-600 hover:underline',
                onclick: () => excluirEntrega(ent.id, reload) }, 'Excluir'),
            ) : '',
          ));
          if (ent.observacao) sub.appendChild(el('div', { class: 'text-xs text-gray-500' }, ent.observacao));
          for (const ei of (ent.entrega_itens || []).filter(x => x.op_id === op.id)) {
            const it = (op.op_itens || []).find(i => i.id === ei.op_item_id);
            const m = it ? modelosById[it.modelo_id] : null;
            const nome = window.rotuloModelo(m);
            sub.appendChild(el('div', { class: 'text-sm text-gray-700' },
              nome + ': ' + window.fmtMetros(ei.metros_entregues),
              ei.defeito ? el('span', { class: 'ml-2 text-red-600 font-semibold' }, '⚠ DEFEITO') : '',
              ei.observacao ? el('span', { class: 'ml-2 text-xs text-gray-500' }, '(' + ei.observacao + ')') : '',
            ));
          }
          box.appendChild(sub);
        }
      }

      function abrirEdicaoAdmin(ent, op, modelosById) {
        const form = buildEntregaInlineForm({ opItens: op.op_itens || [], modelosById, entrega: ent, comDestino: false });
        modal({
          title: `Editar recebimento — ${new Date(ent.data + 'T00:00:00').toLocaleDateString('pt-BR')}`,
          body: form.node, saveLabel: 'Salvar alterações',
          onSave: async () => { const ok = await atualizarEntregaLatex({ entregaId: ent.id, opId: op.id, payload: form.getPayload() }); if (ok) reload(); return ok; },
        });
      }

      container.replaceChildren(header, info, tabela, el('div', { class: 'h-4' }), box);
    }

    async function finalizar(id) {
      confirmDialog({
        title: 'Finalizar OP de látex',
        message: 'Marcar esta OP de látex como finalizada?',
        confirmLabel: 'Finalizar',
        onConfirm: async () => {
          const r = await supa.from('ops').update({ status: 'finalizada', finalizada_em: new Date().toISOString() }).eq('id', id);
          if (r.error) { toast('Erro ao finalizar', 'error'); console.error(r.error); return; }
          toast('OP de látex finalizada', 'success'); reload();
        },
      });
    }

    function editarEnviado(op, modelosById) {
      const linhas = (op.op_itens || []).map(it => {
        const m = modelosById[it.modelo_id];
        const rotulo = m ? `${m.nome} ${larguraKey(m.largura)}m · ${m.cor_1?.nome || '?'}/${m.cor_2?.nome || '?'}` : ('#' + it.modelo_id);
        const input = textInput({ type: 'number', step: '0.01', value: String(it.metros_pedidos) });
        return { id: it.id, input, node: el('div', { class: 'flex items-center gap-2 mb-2' },
          el('div', { class: 'flex-1 text-sm text-gray-700' }, rotulo),
          el('div', { class: 'w-32' }, formField({ label: 'Enviado (m)', input })),
        ) };
      });
      modal({
        title: 'Editar enviado (manual)',
        body: el('div', {}, el('p', { class: 'text-xs text-gray-500 mb-3' }, 'Ajuste os metros enviados por modelo.'), ...linhas.map(l => l.node)),
        saveLabel: 'Salvar',
        onSave: async () => {
          for (const l of linhas) {
            const val = Number(l.input.value);
            if (!Number.isFinite(val) || val <= 0) { toast('Informe um valor maior que zero em todos os modelos', 'error'); return false; }
          }
          for (const l of linhas) {
            const r = await supa.from('op_itens').update({ metros_pedidos: Number(l.input.value) }).eq('id', l.id);
            if (r.error) { toast('Erro ao salvar enviado', 'error'); console.error(r.error); return false; }
          }
          toast('Enviado atualizado', 'success'); reload(); return true;
        },
      });
    }

    function excluirOpLatex(id) {
      confirmDialog({
        title: 'Excluir OP de látex',
        message: 'Isto remove a OP de látex e seus itens. Se já houver recebimentos lançados, a exclusão será bloqueada — exclua os recebimentos primeiro. Continuar?',
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          const r = await supa.from('ops').delete().eq('id', id);
          if (r.error) { toast('Erro ao excluir OP de látex', 'error'); console.error(r.error); return; }
          toast('OP de látex excluída', 'success'); navigate('#/ops');
        },
      });
    }

    await reload();
    return shellLayout(ADMIN_MENU, container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.opLatexAdmin = {
    renderOPLatexAdmin,
  };

  window.renderOPLatexAdmin = renderOPLatexAdmin;
})(window);
