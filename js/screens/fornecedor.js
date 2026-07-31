// =====================================================================
// === SCREENS: FORNECEDOR (Seam A) ====================================
// Telas do usuário com role "fornecedor". Esta fase contém:
//   - screenFornecedorHome      (placeholder Fase 1)
//   - screenFornecedorEntregas  (Fase 5a — Entregas de Tecelagem)
//   - screenFornecedorLatex     (Fase 5b — Recebimentos de Látex)
//   - screenFornecedorOrdens    (OCF — Ordens de Compra de Fio)
//
// Carregar via <script src="js/screens/fornecedor.js"></script> no
// <head>, DEPOIS de js/screens/entrega-writes.js e ANTES do script
// inline principal. As 4 rotas '#/fornecedor/*' são registradas no
// setRoutes inline, referenciando as funções como identificadores
// bare (resolvidos via window.screenFornecedor*).
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.el, window.textInput, window.formField,
//     window.modal, window.toast, window.dataTable,
//     window.pageHeader                            (js/ui.js)
//   - window.badgeStatus                           (js/badges.js)
//   - window.larguraKey,
//     window.totalEntregueCimaPorItem              (js/calculo-op.js)
//   - window.shellLayout                           (js/screens/common.js)
//   - window.rotuloFio,
//     window.OCF_STATUS_LABEL,
//     window.buildEntregaInlineForm                (js/screens/entrega-form.js)
//   - window.salvarEntregaCima,
//     window.atualizarEntregaCima,
//     window.salvarEntregaLatex,
//     window.atualizarEntregaLatex,
//     window.excluirEntrega                        (js/screens/entrega-writes.js)
//   - window.supa                                  (js/supabase-client.js)
//   - window.CURRENT_USER                          (js/auth.js)
//
// Decisões de refator desta fase:
//   - screenFornecedorLatex.abrirEdicao era aninhada dentro de
//     render; foi elevada para o nível de screenFornecedorLatex
//     (continua capturando reload por closure, agora a 1 nível de
//     profundidade). Comportamento preservado.
//   - screenFornecedorOrdens preserva update inline em
//     'ordens_compra_fio' (não foi extraído para entrega-writes).
//
// Compatibilidade: window.screenFornecedorHome,
// window.screenFornecedorEntregas, window.screenFornecedorLatex e
// window.screenFornecedorOrdens seguem disponíveis exatamente como
// antes para o setRoutes no inline (call-sites bare preservados).
// =====================================================================

(function (window) {
  'use strict';

  // -------------------------------------------------------------------
  // screenFornecedorHome — placeholder Fase 1.
  function screenFornecedorHome() {
    const content = window.el('div', {},
      window.el('h1', { style: 'font-size:var(--rv-fs-title);', class: 'font-bold mb-4' }, 'Área do Fornecedor'),
      window.el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-white p-6 shadow' },
        window.el('p', { class: 'text-gray-700' }, 'Olá, ' + window.CURRENT_USER.nome + '. (Fase 1 — placeholder; suas entregas aparecem aqui a partir da Fase 4/5.)')
      )
    );
    return window.shellLayout([
      { href: '#/fornecedor/home', label: 'Minhas OPs' },
    ], content);
  }

  // -------------------------------------------------------------------
  // screenFornecedorEntregas — Fase 5a (Entregas de Tecelagem).
  async function screenFornecedorEntregas() {
    const container = window.el('div', {});
    let latexOptions = [];

    async function reload() {
      if (!window.CURRENT_USER.fornecedor_id) {
        container.replaceChildren(
          window.pageHeader('Minhas entregas'),
          window.el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow p-8 text-center text-gray-500' },
            'Seu usuário não está vinculado a um fornecedor. Fale com o administrador.')
        );
        return;
      }

      const opfRes = await window.supa.from('op_fornecedores')
        .select('op_id, ops!inner(id, numero, ano, identidade_operacional, identidade_pedido_id, status, op_itens(id, modelo_id, metros_pedidos, metros_ajustados))')
        .eq('fornecedor_id', window.CURRENT_USER.fornecedor_id)
        .eq('etapa', 'cima');
      if (opfRes.error) { window.toast('Erro ao carregar OPs', 'error'); console.error(opfRes.error); return; }
      const ops = (opfRes.data || [])
        .map(r => r.ops)
        .filter(o => o && o.status === 'em_producao');

      const entRes = await window.supa.from('entregas')
        .select('id, data, observacao, criado_em, destino_fornecedor_id, destino:destino_fornecedor_id(nome), entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
        .eq('fornecedor_id', window.CURRENT_USER.fornecedor_id)
        .eq('etapa', 'cima')
        .order('data', { ascending: false })
        .order('id', { ascending: false });
      if (entRes.error) { window.toast('Erro ao carregar entregas', 'error'); console.error(entRes.error); return; }
      const entregas = entRes.data || [];

      // P2-B.3: elegibilidade de RECUPERAÇÃO, decidida pelo SERVIDOR por
      // entrega. É esta recarga autoritativa que torna alcançável o estado
      // de falha provada depois de uma entrega cujo acabamento não foi
      // criado. Erro ou ausência do escritor => nenhuma entrega elegível.
      const writes = window.RAVATEX_ENTREGA_WRITES;
      const recuperaveis = {};
      if (writes && typeof writes.podeRecuperarOpAcabamento === 'function' && entregas.length) {
        const checagens = await Promise.all(entregas.map(function (e) {
          return writes.podeRecuperarOpAcabamento(e.id);
        }));
        entregas.forEach(function (e, i) {
          recuperaveis[e.id] = !!(checagens[i] && checagens[i].elegivel === true);
        });
      }

      const modeloIds = [...new Set(ops.flatMap(o => (o.op_itens || []).map(i => i.modelo_id)))];
      const modelosRes = modeloIds.length
        ? await window.supa.from('modelos').select('id, nome, largura, cor_1:cor_1_id(id,nome), cor_2:cor_2_id(id,nome)').in('id', modeloIds)
        : { data: [] };
      const modelosById = {};
      for (const m of (modelosRes.data || [])) modelosById[m.id] = m;

      const latexRes = await window.supa.from('fornecedores').select('id, nome').eq('tipo', 'latex').order('nome');
      if (latexRes.error) { window.toast('Erro ao carregar empresas de látex', 'error'); console.error(latexRes.error); return; }
      latexOptions = (latexRes.data || []).map(f => ({ value: f.id, label: f.nome }));

      render(ops, entregas, modelosById, recuperaveis);
    }

    function linhaHistorico(entrega, modelosById, opsCarregadas, recuperaveis) {
      const itens = entrega.entrega_itens || [];
      const opId = itens[0]?.op_id;
      const opRef = opsCarregadas.find(o => o.id === opId);
      // OP nao presente no conjunto carregado: estado diagnostico explicito do
      // dono central, NUNCA `ops.id`. A chave primaria nao e nome de negocio.
      const opLabel = opRef
        ? window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(opRef)
        : (opId != null ? window.RAVATEX_OP_DISPLAY.IDENTITY_PENDING : window.RAVATEX_OP_DISPLAY.IDENTITY_ABSENT);

      const wrap = window.el('div', { class: 'border-b py-3' });
      wrap.appendChild(window.el('div', { class: 'flex items-center justify-between' },
        window.el('div', {},
          window.el('span', { class: 'text-sm font-medium text-gray-800' }, opLabel + ' · '),
          window.el('span', { class: 'text-sm text-gray-500' }, new Date(entrega.data + 'T00:00:00').toLocaleDateString('pt-BR')),
          window.el('span', { class: 'text-sm text-gray-500' }, ' · látex: ' + (entrega.destino?.nome || '?')),
        ),
        window.el('div', {},
          window.el('button', { class: 'text-sm text-blue-700 hover:underline mr-3',
            onclick: () => abrirEdicao(entrega, opRef, modelosById, latexOptions) }, 'Editar'),
          window.el('button', { class: 'text-sm text-red-600 hover:underline',
            onclick: () => {
              if (!opRef) { window.toast('OP da entrega não está mais em produção', 'error'); return; }
              window.excluirEntrega(entrega.id, reload);
            } }, 'Excluir'),
        ),
      ));
      if (entrega.observacao) wrap.appendChild(window.el('div', { class: 'text-xs text-gray-500 mb-1' }, entrega.observacao));
      for (const ei of itens) {
        const opItem = opRef?.op_itens?.find(i => i.id === ei.op_item_id);
        const modelo = opItem ? modelosById[opItem.modelo_id] : null;
        const nome = modelo
          ? `${modelo.nome} ${window.larguraKey(modelo.largura)}m · ${modelo.cor_1?.nome || '?'}/${modelo.cor_2?.nome || '?'}`
          : '?';
        wrap.appendChild(window.el('div', { class: 'text-sm text-gray-700' },
          nome + ': ' + Number(ei.metros_entregues).toFixed(2).replace('.', ',') + ' m',
          ei.defeito ? window.el('span', { class: 'ml-2 text-red-600 font-semibold' }, '⚠ DEFEITO') : '',
          ei.observacao ? window.el('span', { class: 'ml-2 text-xs text-gray-500' }, '(' + ei.observacao + ')') : '',
        ));
      }
      // Superfície de recuperação: montada SOMENTE quando o servidor provou
      // a falha. O builder é dono só do DOM e delega a escrita ao helper
      // canônico de entrega-writes.js.
      const recovery = window.buildAcabamentoRecoveryBlock && window.buildAcabamentoRecoveryBlock({
        entregaId: entrega.id,
        elegivel: !!(recuperaveis && recuperaveis[entrega.id]),
        onRecuperado: async function (r) {
          window.toast('OP de acabamento criada: ' + ((r && r.rotulo) || 'OP de acabamento'), 'success');
          await reload();
        },
      });
      if (recovery) wrap.appendChild(recovery);
      return wrap;
    }

    function abrirEdicao(entrega, opRef, modelosById, options) {
      if (!opRef) { window.toast('OP da entrega não está mais em produção', 'error'); return; }
      const form = window.buildEntregaInlineForm({ opItens: opRef.op_itens || [], modelosById, entrega, latexOptions: options });
      window.modal({
        title: `Editar entrega — ${window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(opRef)}`,
        body: form.node,
        saveLabel: 'Salvar alterações',
        onSave: async () => {
          const ok = await window.atualizarEntregaCima({ entregaId: entrega.id, opId: opRef.id, payload: form.getPayload() });
          if (ok) reload();
          return ok;
        },
      });
    }

    function render(ops, entregas, modelosById, recuperaveis) {
      const fmtMetros = (n) => Number(n).toFixed(2).replace('.', ',') + ' m';
      const blocos = [window.pageHeader('Minhas entregas')];

      if (ops.length === 0) {
        blocos.push(window.el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow p-8 text-center text-gray-500 mb-6' },
          'Nenhuma OP em produção atribuída a você no momento.'));
      } else {
        for (const op of ops) {
          const itensEntreguesNaOP = entregas
            .flatMap(e => e.entrega_itens || [])
            .filter(ei => ei.op_id === op.id);
          const totalPorItem = window.totalEntregueCimaPorItem(itensEntreguesNaOP);

          const card = window.el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow p-5 mb-6' });
          card.appendChild(window.el('div', { class: 'flex items-center justify-between mb-3' },
            window.el('div', { class: 'font-semibold text-gray-800' },
              window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op)),
            window.badgeStatus(op.status),
          ));

          // Pass-8 §2.5: four metre quantities, so the width owner is declared
          // here and the four numeric columns carry the alignment + tabular
          // numeral contract. Modelo is free text and stays left.
          card.appendChild(window.dataTable({
            columns: [
              { key: 'modelo', label: 'Modelo', width: '40%', render: (i) => {
                  const m = modelosById[i.modelo_id];
                  return m ? `${m.nome} ${window.larguraKey(m.largura)}m · ${m.cor_1?.nome || '?'}/${m.cor_2?.nome || '?'}` : ('#' + i.modelo_id);
                } },
              { key: 'metros_pedidos', label: 'Pedido', width: '15%', numeric: true, render: (i) => fmtMetros(i.metros_pedidos) },
              { key: 'metros_ajustados', label: 'Ajustado', width: '15%', numeric: true, render: (i) => i.metros_ajustados == null ? fmtMetros(i.metros_pedidos) : fmtMetros(i.metros_ajustados) },
              { key: 'entregue', label: 'Entregue', width: '15%', numeric: true, render: (i) => fmtMetros(totalPorItem[i.id] || 0) },
              { key: 'falta', label: 'Falta', width: '15%', numeric: true, render: (i) => {
                  const ajustado = i.metros_ajustados == null ? Number(i.metros_pedidos) : Number(i.metros_ajustados);
                  const falta = Math.round((ajustado - (totalPorItem[i.id] || 0)) * 100) / 100;
                  const cor = falta <= 0 ? 'text-green-700' : 'text-gray-800';
                  const texto = falta <= 0 ? '✅ completo' : fmtMetros(falta);
                  return window.el('span', { class: cor }, texto);
                } },
            ],
            rows: op.op_itens || [],
          }));

          const formHolder = window.el('div', {});
          const btnNova = window.el('button', {
            class: 'mt-3 text-sm text-blue-700 hover:underline',
            onclick: () => {
              const form = window.buildEntregaInlineForm({ opItens: op.op_itens || [], modelosById, latexOptions });
              const btnSalvar = window.el('button', {
                style: 'border-radius:var(--rv-radius);', class: 'bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-3 py-2 mr-2',
                onclick: async () => {
                  btnSalvar.disabled = true;
                  const ok = await window.salvarEntregaCima({ fornecedorId: window.CURRENT_USER.fornecedor_id, opId: op.id, payload: form.getPayload() });
                  btnSalvar.disabled = false;
                  if (ok) reload();
                },
              }, 'Salvar entrega');
              const btnCancelar = window.el('button', {
                style: 'border-radius:var(--rv-radius);', class: 'bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold px-3 py-2',
                onclick: () => { formHolder.replaceChildren(); btnNova.style.display = ''; },
              }, 'Cancelar');
              const wrap = window.el('div', {}, form.node, window.el('div', { class: 'mt-2' }, btnSalvar, btnCancelar));
              formHolder.replaceChildren(wrap);
              btnNova.style.display = 'none';
            },
          }, '+ Nova entrega');
          card.appendChild(btnNova);
          card.appendChild(formHolder);

          blocos.push(card);
        }
      }

      blocos.push(window.el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow p-5 mb-6' },
        window.el('div', { class: 'font-semibold text-gray-700 mb-3' }, 'Histórico de entregas'),
        entregas.length === 0
          ? window.el('p', { class: 'text-sm text-gray-400' }, 'Nenhuma entrega registrada ainda.')
          : window.el('div', {}, entregas.map(ent => linhaHistorico(ent, modelosById, ops, recuperaveis))),
      ));

      container.replaceChildren(...blocos);
    }

    await reload();
    return window.shellLayout([{ href: '#/fornecedor/entregas', label: 'Minhas entregas' }], container);
  }

  // -------------------------------------------------------------------
  // screenFornecedorLatex — Fase 5b (Recebimentos de Látex).
  // `abrirEdicao` foi elevada do aninhamento em `render` para o
  // nível desta função (captura `reload` por closure a 1 nível).
  async function screenFornecedorLatex() {
    const container = window.el('div', {});
    let latexOptions = [];

    async function reload() {
      if (!window.CURRENT_USER.fornecedor_id) {
        container.replaceChildren(
          window.pageHeader('Meus recebimentos de látex'),
          window.el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow p-8 text-center text-gray-500' },
            'Seu usuário não está vinculado a um fornecedor. Fale com o administrador.')
        );
        return;
      }

      const opfRes = await window.supa.from('op_fornecedores')
        .select('op_id, ops!inner(id, numero, ano, identidade_operacional, identidade_pedido_id, status, tipo, observacao, origem_op_id, op_itens(id, modelo_id, metros_pedidos))')
        .eq('fornecedor_id', window.CURRENT_USER.fornecedor_id)
        .eq('etapa', 'latex');
      if (opfRes.error) { window.toast('Erro ao carregar OPs de látex', 'error'); console.error(opfRes.error); return; }
      const ops = (opfRes.data || [])
        .map(r => r.ops)
        .filter(o => o && o.tipo === 'latex' && o.status === 'em_producao');

      const entRes = await window.supa.from('entregas')
        .select('id, data, observacao, criado_em, entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
        .eq('fornecedor_id', window.CURRENT_USER.fornecedor_id)
        .eq('etapa', 'latex')
        .order('data', { ascending: false })
        .order('id', { ascending: false });
      if (entRes.error) { window.toast('Erro ao carregar recebimentos', 'error'); console.error(entRes.error); return; }
      const entregas = entRes.data || [];

      const modeloIds = [...new Set(ops.flatMap(o => (o.op_itens || []).map(i => i.modelo_id)))];
      const modelosRes = modeloIds.length
        ? await window.supa.from('modelos').select('id, nome, largura, cor_1:cor_1_id(id,nome), cor_2:cor_2_id(id,nome)').in('id', modeloIds)
        : { data: [] };
      const modelosById = {};
      for (const m of (modelosRes.data || [])) modelosById[m.id] = m;

      render(ops, entregas, modelosById);
    }

    function abrirEdicao(entrega, opRef, modelosById) {
      if (!opRef) { window.toast('OP de látex não está mais em produção', 'error'); return; }
      const form = window.buildEntregaInlineForm({ opItens: opRef.op_itens || [], modelosById, entrega, comDestino: false });
      window.modal({
        title: `Editar recebimento — ${window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(opRef)}`,
        body: form.node,
        saveLabel: 'Salvar alterações',
        onSave: async () => {
          const ok = await window.atualizarEntregaLatex({ entregaId: entrega.id, opId: opRef.id, payload: form.getPayload() });
          if (ok) reload();
          return ok;
        },
      });
    }

    function render(ops, entregas, modelosById) {
      const fmtMetros = (n) => Number(n).toFixed(2).replace('.', ',') + ' m';
      const blocos = [window.pageHeader('Meus recebimentos de látex')];

      if (ops.length === 0) {
        blocos.push(window.el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow p-8 text-center text-gray-500 mb-6' },
          'Nenhuma OP de látex em produção atribuída a você no momento.'));
      } else {
        for (const op of ops) {
          const recebidosNaOP = entregas.flatMap(e => e.entrega_itens || []).filter(ei => ei.op_id === op.id);
          const totalPorItem = window.totalEntregueCimaPorItem(recebidosNaOP);

          const card = window.el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow p-5 mb-6' });
          card.appendChild(window.el('div', { class: 'flex items-center justify-between mb-3' },
            window.el('div', { class: 'font-semibold text-gray-800' },
              window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op)),
            window.badgeStatus(op.status),
          ));
          if (op.observacao) card.appendChild(window.el('div', { class: 'text-xs text-gray-500 mb-2' }, op.observacao));

          // Pass-8 §2.5: three metre quantities behind one declared width owner.
          card.appendChild(window.dataTable({
            columns: [
              { key: 'modelo', label: 'Modelo', width: '46%', render: (i) => {
                  const m = modelosById[i.modelo_id];
                  return m ? `${m.nome} ${window.larguraKey(m.largura)}m · ${m.cor_1?.nome || '?'}/${m.cor_2?.nome || '?'}` : ('#' + i.modelo_id);
                } },
              { key: 'enviado', label: 'Enviado', width: '18%', numeric: true, render: (i) => fmtMetros(i.metros_pedidos) },
              { key: 'recebido', label: 'Recebido', width: '18%', numeric: true, render: (i) => fmtMetros(totalPorItem[i.id] || 0) },
              { key: 'falta', label: 'Falta', width: '18%', numeric: true, render: (i) => {
                  const falta = Math.round((Number(i.metros_pedidos) - (totalPorItem[i.id] || 0)) * 100) / 100;
                  const cor = falta <= 0 ? 'text-green-700' : 'text-gray-800';
                  return window.el('span', { class: cor }, falta <= 0 ? '✅ completo' : fmtMetros(falta));
                } },
            ],
            rows: op.op_itens || [],
          }));

          const formHolder = window.el('div', {});
          const btnNova = window.el('button', {
            class: 'mt-3 text-sm text-blue-700 hover:underline',
            onclick: () => {
              const form = window.buildEntregaInlineForm({ opItens: op.op_itens || [], modelosById, comDestino: false });
              const btnSalvar = window.el('button', {
                style: 'border-radius:var(--rv-radius);', class: 'bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-3 py-2 mr-2',
                onclick: async () => {
                  btnSalvar.disabled = true;
                  const ok = await window.salvarEntregaLatex({ fornecedorId: window.CURRENT_USER.fornecedor_id, opId: op.id, payload: form.getPayload() });
                  btnSalvar.disabled = false;
                  if (ok) reload();
                },
              }, 'Salvar recebimento');
              const btnCancelar = window.el('button', {
                style: 'border-radius:var(--rv-radius);', class: 'bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold px-3 py-2',
                onclick: () => { formHolder.replaceChildren(); btnNova.style.display = ''; },
              }, 'Cancelar');
              formHolder.replaceChildren(window.el('div', {}, form.node, window.el('div', { class: 'mt-2' }, btnSalvar, btnCancelar)));
              btnNova.style.display = 'none';
            },
          }, '+ Novo recebimento');
          card.appendChild(btnNova);
          card.appendChild(formHolder);
          blocos.push(card);
        }
      }

      const opsById = {};
      for (const o of ops) opsById[o.id] = o;
      blocos.push(window.el('div', { class: 'font-semibold text-gray-700 mb-2 mt-2' }, 'Histórico de recebimentos'));
      const histWrap = window.el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow p-5' });
      if (entregas.length === 0) {
        histWrap.appendChild(window.el('p', { class: 'text-sm text-gray-400' }, 'Nenhum recebimento registrado ainda.'));
      } else {
        for (const entrega of entregas) {
          const itens = entrega.entrega_itens || [];
          const opId = itens[0]?.op_id;
          const opRef = opsById[opId];
          // Mesma regra da tela de latex: sem a linha da OP, estado diagnostico
          // explicito, nunca `ops.id`.
          const opLabel = opRef
            ? window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(opRef)
            : (opId != null ? window.RAVATEX_OP_DISPLAY.IDENTITY_PENDING : window.RAVATEX_OP_DISPLAY.IDENTITY_ABSENT);
          const wrap = window.el('div', { class: 'border-b py-3' });
          wrap.appendChild(window.el('div', { class: 'flex items-center justify-between' },
            window.el('div', {},
              window.el('span', { class: 'text-sm font-medium text-gray-800' }, opLabel + ' · '),
              window.el('span', { class: 'text-sm text-gray-500' }, new Date(entrega.data + 'T00:00:00').toLocaleDateString('pt-BR')),
            ),
            window.el('div', {},
              window.el('button', { class: 'text-sm text-blue-700 hover:underline mr-3',
                onclick: () => abrirEdicao(entrega, opRef, modelosById) }, 'Editar'),
              window.el('button', { class: 'text-sm text-red-600 hover:underline',
                onclick: () => { if (!opRef) { window.toast('OP de látex não está mais em produção', 'error'); return; } window.excluirEntrega(entrega.id, reload); } }, 'Excluir'),
            ),
          ));
          if (entrega.observacao) wrap.appendChild(window.el('div', { class: 'text-xs text-gray-500 mb-1' }, entrega.observacao));
          for (const ei of itens) {
            const opItem = opRef?.op_itens?.find(i => i.id === ei.op_item_id);
            const modelo = opItem ? modelosById[opItem.modelo_id] : null;
            const nome = modelo ? `${modelo.nome} ${window.larguraKey(modelo.largura)}m · ${modelo.cor_1?.nome || '?'}/${modelo.cor_2?.nome || '?'}` : '?';
            wrap.appendChild(window.el('div', { class: 'text-sm text-gray-700' },
              nome + ': ' + Number(ei.metros_entregues).toFixed(2).replace('.', ',') + ' m',
              ei.defeito ? window.el('span', { class: 'ml-2 text-red-600 font-semibold' }, '⚠ DEFEITO') : '',
              ei.observacao ? window.el('span', { class: 'ml-2 text-xs text-gray-500' }, '(' + ei.observacao + ')') : '',
            ));
          }
          histWrap.appendChild(wrap);
        }
      }
      blocos.push(histWrap);

      container.replaceChildren(...blocos);
    }

    await reload();
    return window.shellLayout([{ href: '#/fornecedor/latex', label: 'Meus recebimentos de látex' }], container);
  }

  // -------------------------------------------------------------------
  // FILA DE ACEITE DO FORNECEDOR (P2-B.1, db/103 / §9.9.E)
  //
  // A fila é AUTORITATIVA e vem inteira do servidor por
  // `listar_fila_aceite_fornecedor`, que já resolve o fornecedor do usuário
  // autenticado e devolve só as ordens que ele pode decidir. Nenhuma
  // consulta genérica a `ordem_compra` ou a `fornecedores` substitui ou
  // complementa essa fila — se o servidor não listou, o fornecedor não vê.
  //
  // EMISSÃO NÃO É ACEITE. Uma ordem emitida entra na fila como PENDENTE de
  // decisão; nada aqui trata `emitida` como aceita, e o comportamento de
  // emissão não é tocado.
  //
  // Idempotência: uma chave estável por INTENÇÃO de decisão (ordem +
  // decisão + motivo). Reenvio da mesma intenção depois de falha ambígua
  // reusa a chave; qualquer desfecho determinístico fecha a tentativa.
  function criarRastreadorDecisao() {
    const api = window.RAVATEX_ENTREGA_WRITES;
    if (api && typeof api.criarRastreadorComando === 'function') return api.criarRastreadorComando();
    // Fallback local: mantém o contrato mesmo sem o dono canônico carregado.
    let token = null; let intencao = null;
    return {
      resolverChave(atual) {
        const serial = JSON.stringify(atual);
        if (token && intencao === serial) return token;
        token = 'aceite-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        intencao = serial;
        return token;
      },
      concluir() { token = null; intencao = null; },
    };
  }

  async function carregarFilaAceite() {
    const res = await window.supa.rpc('listar_fila_aceite_fornecedor');
    if (res.error) return { linhas: null, error: res.error };
    return { linhas: Array.isArray(res.data) ? res.data : [], error: null };
  }

  // Uma linha da fila. Aceitar e rejeitar são DUAS ações distintas com
  // escritores canônicos distintos; rejeitar exige motivo não vazio e, sem
  // motivo, NENHUM escritor é chamado.
  function buildLinhaAceite(ordem, onDecidida) {
    const rastreador = criarRastreadorDecisao();
    let pendente = false;

    const motivoInput = window.textInput({ type: 'text', placeholder: 'motivo (obrigatório para rejeitar)' });
    motivoInput.setAttribute('aria-label', 'Motivo da decisão');

    const alerta = window.el('div', {
      role: 'alert',
      'aria-live': 'assertive',
      style: 'display:none;margin-top:8px;font-size:13px;font-weight:700;color:var(--rv-signal-negative);',
    });
    function mostrarErro(texto) { alerta.textContent = texto; alerta.style.display = 'block'; }
    function limparErro() { alerta.textContent = ''; alerta.style.display = 'none'; }

    const btnAceitar = window.el('button', { type: 'button', style: ACEITE_BTN_PRIMARY }, 'Aceitar');
    const btnRejeitar = window.el('button', { type: 'button', style: ACEITE_BTN_SECONDARY }, 'Rejeitar');

    function travar(v) {
      pendente = v;
      btnAceitar.disabled = v;
      btnRejeitar.disabled = v;
    }

    async function decidir(decisao) {
      if (pendente) return;                       // clique repetido não vira 2º comando
      limparErro();
      const motivo = motivoInput.value ? String(motivoInput.value).trim() : '';
      if (decisao === 'rejeitada' && !motivo) {
        // Recusa LOCAL: nenhum escritor é chamado sem motivo.
        mostrarErro('Informe o motivo para rejeitar esta ordem.');
        motivoInput.focus();
        return;
      }
      const chave = rastreador.resolverChave({
        ordem_compra_id: ordem.ordem_compra_id,
        decisao: decisao,
        motivo: motivo || null,
      });
      travar(true);
      try {
        const rpcName = decisao === 'aceita' ? 'aceitar_ordem_compra' : 'rejeitar_ordem_compra';
        const params = { p_ordem_id: ordem.ordem_compra_id, p_idempotency_key: chave };
        if (decisao === 'aceita') { if (motivo) params.p_motivo = motivo; }
        else { params.p_motivo = motivo; }
        const res = await window.supa.rpc(rpcName, params);
        if (res.error) {
          // Transporte ambíguo: a chave é retida para um reenvio seguro.
          mostrarErro('Não foi possível confirmar a decisão. Tente novamente — o reenvio é seguro.');
          console.error('fornecedor: ' + rpcName, res.error);
          return;
        }
        rastreador.concluir();
        const data = res.data || {};
        if (data.ok !== true) {
          mostrarErro('Decisão recusada: ' + (data.codigo || 'motivo não informado pelo servidor'));
          console.error('fornecedor: decisão recusada', data);
          return;
        }
        window.toast(decisao === 'aceita' ? 'Ordem aceita.' : 'Ordem rejeitada.', 'success');
        if (typeof onDecidida === 'function') await onDecidida();
      } finally {
        travar(false);
      }
    }

    btnAceitar.addEventListener('click', function () { return decidir('aceita'); });
    btnRejeitar.addEventListener('click', function () { return decidir('rejeitada'); });

    const fmtKg = (n) => (n == null ? '—' : Number(n).toFixed(3).replace('.', ',') + ' kg');
    return window.el('div', {
      'data-rv-aceite-linha': '',
      style: 'border-bottom:1px solid var(--rv-border-soft);padding:12px 0;',
    },
      window.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;' },
        window.el('div', {},
          window.el('div', { style: 'font-size:13.5px;font-weight:700;color:var(--rv-text-primary);' },
            ordem.identidade_operacional || ordem.codigo || ('Ordem #' + ordem.ordem_compra_id)),
          window.el('div', { style: 'font-size:12px;color:var(--rv-text-tertiary);margin-top:2px;' },
            fmtKg(ordem.kg_total) + ' · ' + (ordem.itens != null ? ordem.itens : 0) + ' item(ns)'
            + ' · emitida em ' + (ordem.emitida_em ? new Date(ordem.emitida_em).toLocaleDateString('pt-BR') : '—'))),
        window.el('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;' },
          motivoInput, btnAceitar, btnRejeitar)),
      alerta);
  }

  var ACEITE_BTN_PRIMARY = 'display:inline-flex;align-items:center;gap:7px;background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;border-radius:var(--rv-radius);padding:0 16px;min-height:var(--rv-h-compact);font-weight:700;font-size:var(--rv-fs-sm);font-family:inherit;cursor:pointer;';
  var ACEITE_BTN_SECONDARY = 'display:inline-flex;align-items:center;gap:7px;background:var(--rv-surface);color:var(--rv-text-primary);border:1px solid var(--rv-border-strong);border-radius:var(--rv-radius);padding:0 16px;min-height:var(--rv-h-compact);font-weight:600;font-size:var(--rv-fs-sm);font-family:inherit;cursor:pointer;';

  // Seção completa da fila. `estado` distingue INDISPONÍVEL (o servidor não
  // respondeu) de VAZIA (respondeu, nada a decidir) — os dois nunca se
  // confundem.
  function buildFilaAceiteSection(fila, onDecidida) {
    const card = window.el('div', {
      'data-rv-fila-aceite': '',
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:var(--rv-radius);padding:18px 20px;margin-bottom:16px;',
    },
      window.el('div', { style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);margin-bottom:4px;' },
        'Pedidos de Compra aguardando sua decisão'),
      window.el('div', { style: 'font-size:12.5px;color:var(--rv-text-tertiary);margin-bottom:12px;' },
        'Uma ordem emitida ainda NÃO está aceita. Aceite ou rejeite cada uma explicitamente.'));

    if (fila.error) {
      card.appendChild(window.el('div', {
        role: 'alert',
        'aria-live': 'assertive',
        style: 'font-size:13px;font-weight:700;color:var(--rv-signal-negative);',
      }, 'Não foi possível carregar a fila de aceite. Nenhuma decisão pode ser tomada agora.'));
      return card;
    }
    if (!fila.linhas.length) {
      card.appendChild(window.el('div', { style: 'font-size:13px;color:var(--rv-text-tertiary);' },
        'Nenhum Pedido de Compra aguardando sua decisão.'));
      return card;
    }
    fila.linhas.forEach(function (ordem) {
      card.appendChild(buildLinhaAceite(ordem, onDecidida));
    });
    return card;
  }

  // -------------------------------------------------------------------
  // screenFornecedorOrdens — OCF (Ordens de Compra de Fio).
  // O update inline em 'ordens_compra_fio' foi preservado como está
  // (decisão do DIAG: não criar helper novo nesta fase).
  async function screenFornecedorOrdens() {
    const container = window.el('div', {});
    // P2-B.1: a fila de aceite é recarregada AUTORITATIVAMENTE a cada
    // decisão bem-sucedida — o cliente nunca remove a linha localmente.
    let filaAceite = { linhas: [], error: null };

    async function reload() {
      if (!window.CURRENT_USER.fornecedor_id) {
        container.replaceChildren(
          window.pageHeader('Minhas ordens'),
          window.el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow p-8 text-center text-gray-500' },
            'Seu usuário não está vinculado a um fornecedor. Fale com o administrador.')
        );
        return;
      }
      // PHASE-C3C-B (docs/architecture/ORDEM_COMPRA_C3C_B_PHASE_CONTRACT.md
      // §32): independent reader, not unified with pedido-detail-data.js /
      // op-nova.js. Attempts the canonical legacy-compat projection first;
      // falls back to the exact pre-phase flat select, byte-identical, only
      // on the documented inactive signal or the bounded missing-function
      // condition.
      filaAceite = await carregarFilaAceite();
      const cutover = window.RAVATEX_SCREENS && window.RAVATEX_SCREENS.ordemCompraReceiptCutover;
      if (cutover) {
        const canonical = await cutover.attemptCanonicalRead({});
        if (canonical.outcome === 'canonical_success') { render(canonical.rows); return; }
        if (canonical.outcome === 'hard_failure') {
          window.toast('Erro ao carregar ordens', 'error');
          console.error(canonical.error);
          return;
        }
        // outcome === 'legacy_fallback' — fall through to the exact existing
        // flat read below.
      }
      const { data, error } = await window.supa.from('ordens_compra_fio')
        .select('id, tipo, cor_poliester, kg_pedido, kg_recebido, data_recebimento, status, ops(numero, ano, identidade_operacional, identidade_pedido_id), cores:cor_id(id, nome)')
        .order('id', { ascending: true });
      if (error) { window.toast('Erro ao carregar ordens', 'error'); console.error(error); return; }
      render(data || []);
    }

    function lote(ordem) {
      return ordem.ops ? window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(ordem.ops) : '—';
    }
    const fmtKg = (n) => (n == null ? '—' : Number(n).toFixed(3).replace('.', ',') + ' kg');

    function linhaPendente(ordem) {
      const kgInput = window.textInput({ type: 'number', step: '0.001', value: String(ordem.kg_pedido) });
      const dataInput = window.textInput({ type: 'date', value: new Date().toISOString().slice(0, 10) });
      // PHASE-C3C-B §34: this row owns its own idempotency-attempt tracker
      // (independent from op-writes.js/op-nova.js — fornecedor.js remains an
      // independent writer, never routed through registrarRecebimentoOrdemFio).
      // Alive for the row's lifetime; a retry of unchanged intent after an
      // ambiguous transport failure reuses the same token; any deterministic
      // outcome closes it.
      const cutover = window.RAVATEX_SCREENS && window.RAVATEX_SCREENS.ordemCompraReceiptCutover;
      const attemptTracker = cutover ? cutover.createAttemptTracker() : null;
      const btn = window.el('button', {
        style: 'border-radius:var(--rv-radius);', class: 'bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-3 py-2',
        onclick: async () => {
          const kg = Number(kgInput.value);
          if (!(kg > 0)) { window.toast('Informe o kg recebido', 'error'); return; }
          const dataRec = dataInput.value || new Date().toISOString().slice(0, 10);
          const status = kg < Number(ordem.kg_pedido) ? 'recebido_parcial' : 'recebido_total';
          btn.disabled = true;

          // A canonical decremento_exige_admin (or any other recognized
          // error code) fails closed here — never falls back to a flat
          // decrease after a canonical-active response.
          if (cutover) {
            const attempt = attemptTracker.resolveAttempt({ ordemId: ordem.id, kg: kg, dataRec: dataRec });
            const canonical = await cutover.attemptCanonicalReceipt({
              ordensCompraFioId: ordem.id,
              kgTotalAbsoluto: kg,
              dataRecebimento: dataRec,
            }, attempt);
            if (canonical.outcome === 'canonical_success') {
              attemptTracker.complete();
              window.toast('Recebimento registrado', 'success');
              reload();
              return;
            }
            if (canonical.outcome === 'ambiguous_failure') {
              // Server commit status unknown — fail closed, no flat
              // fallback, retain the attempt for a retry of unchanged intent.
              window.toast('Erro ao registrar recebimento', 'error');
              console.error(canonical.error);
              btn.disabled = false;
              return;
            }
            if (canonical.outcome === 'hard_failure') {
              attemptTracker.complete();
              window.toast('Erro ao registrar recebimento', 'error');
              console.error(canonical.error || canonical.result);
              btn.disabled = false;
              return;
            }
            // outcome === 'legacy_fallback' — fall through to the exact
            // existing flat write below.
          }

          const { error } = await window.supa.from('ordens_compra_fio')
            .update({ kg_recebido: kg, data_recebimento: dataRec, status })
            .eq('id', ordem.id);
          if (error) { window.toast('Erro ao registrar recebimento', 'error'); console.error(error); btn.disabled = false; return; }
          if (attemptTracker) attemptTracker.complete();
          window.toast('Recebimento registrado', 'success');
          reload();
        }
      }, 'Registrar');

      return window.el('div', { class: 'flex flex-wrap items-end gap-3 border-b py-3' },
        window.el('div', { class: 'flex-1 min-w-[160px]' },
          window.el('div', { class: 'text-xs text-gray-500' }, lote(ordem)),
          window.el('div', { class: 'font-medium text-gray-800' }, window.rotuloFio(ordem)),
          window.el('div', { class: 'text-xs text-gray-500' }, 'Pedido: ' + fmtKg(ordem.kg_pedido)),
        ),
        window.el('div', { class: 'w-32' }, window.formField({ label: 'Kg recebido', input: kgInput })),
        window.el('div', { class: 'w-40' }, window.formField({ label: 'Data', input: dataInput })),
        btn,
      );
    }

    function render(rows) {
      const pendentes = rows.filter(r => r.status === 'pendente');
      const recebidas = rows.filter(r => r.status !== 'pendente');

      const blocos = [window.pageHeader('Minhas ordens')];

      // A fila de ACEITE (decisão sobre o Pedido de Compra) vem primeiro e é
      // uma projeção distinta da lista de RECEBIMENTO de fio abaixo: uma
      // decide o documento, a outra registra material recebido.
      blocos.push(buildFilaAceiteSection(filaAceite, reload));

      blocos.push(window.el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow p-5 mb-6' },
        window.el('div', { class: 'font-semibold text-gray-700 mb-2' }, 'Pendentes'),
        pendentes.length === 0
          ? window.el('p', { class: 'text-sm text-gray-400' }, 'Nenhuma ordem pendente.')
          : window.el('div', {}, pendentes.map(linhaPendente)),
      ));

      blocos.push(window.el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow p-5' },
        window.el('div', { class: 'font-semibold text-gray-700 mb-2' }, 'Recebidas'),
        recebidas.length === 0
          ? window.el('p', { class: 'text-sm text-gray-400' }, 'Nenhuma ordem recebida ainda.')
          // Pass-8 §2.5: only the two kg columns are quantities. Lote is a
          // categorical identifier and Data is a temporal label (architect
          // rulings 6.1 / 6.2), so both stay left-aligned.
          : window.dataTable({
              columns: [
                { key: 'lote', label: 'Lote', width: '16%', render: lote },
                { key: 'fio', label: 'Fio', width: '26%', render: window.rotuloFio },
                { key: 'kg_pedido', label: 'Pedido', width: '13%', numeric: true, render: (r) => fmtKg(r.kg_pedido) },
                { key: 'kg_recebido', label: 'Recebido', width: '13%', numeric: true, render: (r) => fmtKg(r.kg_recebido) },
                { key: 'data', label: 'Data', width: '16%', render: (r) => new Date(r.data_recebimento + 'T00:00:00').toLocaleDateString('pt-BR') },
                { key: 'status', label: 'Status', width: '16%', render: (r) => window.OCF_STATUS_LABEL[r.status] || r.status },
              ],
              rows: recebidas,
            }),
      ));

      container.replaceChildren(...blocos);
    }

    await reload();
    return window.shellLayout([{ href: '#/fornecedor/ordens', label: 'Minhas ordens' }], container);
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.fornecedor = {
    screenFornecedorHome,
    screenFornecedorEntregas,
    screenFornecedorLatex,
    screenFornecedorOrdens,
    // P2-B.1: a fila de aceite e seus dois construtores ficam acessiveis para
    // prova direta, sem precisar renderizar a tela inteira.
    carregarFilaAceite,
    buildLinhaAceite,
    buildFilaAceiteSection,
  };

  // Compatibilidade com o inline (call-sites bare preservados).
  window.screenFornecedorHome = screenFornecedorHome;
  window.screenFornecedorEntregas = screenFornecedorEntregas;
  window.screenFornecedorLatex = screenFornecedorLatex;
  window.screenFornecedorOrdens = screenFornecedorOrdens;
})(window);
