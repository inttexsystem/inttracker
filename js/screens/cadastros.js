// =====================================================================
// === SCREENS: CADASTROS (Seam A) ======================================
// Telas de cadastros administrativos (cores, clientes, modelos,
// parametros, fornecedores, precos, usuarios) + constantes diretamente
// relacionadas (FORNECEDOR_TIPOS, labelFornecedorTipo). Extraidas do
// <script> inline de index.html sem alterar comportamento, tabelas
// Supabase, CRUD ou regras de negocio.
//
// Carregar via <script src="js/screens/cadastros.js"></script> no
// <head>, DEPOIS de js/screens/common.js e ANTES do script inline
// principal (o setRoutes do inline referencia as globais legadas
// expostas por este modulo).
//
// Dependencias resolvidas em tempo de chamada (nao no load):
//   - window.el / window.toast / window.modal / window.confirmDialog
//     / window.formField / window.textInput / window.selectInput
//     / window.dataTable / window.pageHeader   (js/ui.js)
//   - window.shellLayout / window.ADMIN_MENU  (js/screens/common.js)
//   - window.supa                            (js/supabase-client.js)
//
// Compatibilidade: window.screenCadastros{Cores,Clientes,Modelos,
// Parametros,Fornecedores,Precos,Usuarios}, window.FORNECEDOR_TIPOS
// e window.labelFornecedorTipo continuam disponiveis exatamente como
// antes para o setRoutes no inline.
// =====================================================================

(function (window) {
  'use strict';

  // -------------------------------------------------------------------
  // Constantes / helpers diretamente relacionados
  // -------------------------------------------------------------------

  const FORNECEDOR_TIPOS = [
    { value: 'fio_algodao',   label: 'Fornecedor de Algodão' },
    { value: 'fio_poliester', label: 'Fornecedor de Poliéster' },
    { value: 'tecelagem',     label: 'Tecelagem (parte de cima)' },
    { value: 'latex',         label: 'Látex (acabamento)' },
  ];

  function labelFornecedorTipo(tipo) {
    return FORNECEDOR_TIPOS.find(t => t.value === tipo)?.label || tipo;
  }

  // -------------------------------------------------------------------
  // Telas
  // -------------------------------------------------------------------

  async function screenCadastrosCores() {
    const container = window.el('div', {});

    async function reload() {
      const { data, error } = await window.supa.from('cores').select('*').order('nome');
      if (error) { window.toast('Erro ao carregar cores', 'error'); console.error(error); return; }
      render(data || []);
    }

    function render(rows) {
      container.replaceChildren(
        window.pageHeader('Cores', [{ label: '+ Nova cor', onclick: () => openModal(null) }]),
        window.dataTable({
          columns: [
            { key: 'id', label: 'ID' },
            { key: 'nome', label: 'Nome' },
          ],
          rows,
          actions: [
            { label: 'Editar', onclick: (r) => openModal(r) },
            { label: 'Excluir', class: 'text-red-600 hover:underline', onclick: (r) => confirmExcluir(r) },
          ]
        })
      );
    }

    function openModal(cor) {
      const isEdit = !!cor;
      const nomeInput = window.textInput({ value: cor?.nome || '', placeholder: 'Ex: VERMELHO', required: true });
      const body = window.el('div', {}, window.formField({ label: 'Nome', input: nomeInput, hint: 'Use letras maiúsculas pra padronizar' }));
      window.modal({
        title: isEdit ? 'Editar cor' : 'Nova cor',
        body,
        onSave: async () => {
          const nome = nomeInput.value.trim().toUpperCase();
          if (!nome) { window.toast('Nome é obrigatório', 'error'); return false; }
          const payload = { nome };
          const { error } = isEdit
            ? await window.supa.from('cores').update(payload).eq('id', cor.id)
            : await window.supa.from('cores').insert(payload);
          if (error) { window.toast(error.message.includes('duplicate') ? 'Cor já cadastrada' : 'Erro ao salvar', 'error'); console.error(error); return false; }
          window.toast(isEdit ? 'Cor atualizada' : 'Cor criada', 'success');
          reload();
        }
      });
    }

    function confirmExcluir(cor) {
      window.confirmDialog({
        title: 'Excluir cor',
        message: `Excluir "${cor.nome}"? Se algum modelo usar essa cor, a exclusão vai falhar.`,
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          const { error } = await window.supa.from('cores').delete().eq('id', cor.id);
          if (error) { window.toast('Cor está em uso (não dá pra excluir)', 'error'); console.error(error); return; }
          window.toast('Cor excluída', 'success');
          reload();
        }
      });
    }

    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  async function screenCadastrosClientes() {
    const container = window.el('div', {});

    async function reload() {
      const { data, error } = await window.supa.from('clientes').select('*').order('nome');
      if (error) { window.toast('Erro ao carregar clientes', 'error'); console.error(error); return; }
      render(data || []);
    }

    function render(rows) {
      container.replaceChildren(
        window.pageHeader('Clientes', [{ label: '+ Novo cliente', onclick: () => openModal(null) }]),
        window.dataTable({
          columns: [
            { key: 'id', label: 'ID' },
            { key: 'nome', label: 'Nome' },
          ],
          rows,
          actions: [
            { label: 'Editar', onclick: (r) => openModal(r) },
            { label: 'Excluir', class: 'text-red-600 hover:underline', onclick: (r) => confirmExcluir(r) },
          ]
        })
      );
    }

    function openModal(cli) {
      const isEdit = !!cli;
      const nomeInput = window.textInput({ value: cli?.nome || '', placeholder: 'Ex: LOJA CENTRAL', required: true });
      const body = window.el('div', {}, window.formField({ label: 'Nome', input: nomeInput }));
      window.modal({
        title: isEdit ? 'Editar cliente' : 'Novo cliente',
        body,
        onSave: async () => {
          const nome = nomeInput.value.trim();
          if (!nome) { window.toast('Nome é obrigatório', 'error'); return false; }
          const payload = { nome };
          const { error } = isEdit
            ? await window.supa.from('clientes').update(payload).eq('id', cli.id)
            : await window.supa.from('clientes').insert(payload);
          if (error) { window.toast(error.message.includes('duplicate') ? 'Cliente já cadastrado' : 'Erro ao salvar', 'error'); console.error(error); return false; }
          window.toast(isEdit ? 'Cliente atualizado' : 'Cliente criado', 'success');
          reload();
        }
      });
    }

    function confirmExcluir(cli) {
      window.confirmDialog({
        title: 'Excluir cliente',
        message: `Excluir "${cli.nome}"? Se algum lote usar esse cliente, a exclusão vai falhar.`,
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          const { error } = await window.supa.from('clientes').delete().eq('id', cli.id);
          if (error) { window.toast('Cliente está em uso (não dá pra excluir)', 'error'); console.error(error); return; }
          window.toast('Cliente excluído', 'success');
          reload();
        }
      });
    }

    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  async function screenCadastrosModelos() {
    const container = window.el('div', {});

    async function reload() {
      const [modelosRes, coresRes] = await Promise.all([
        window.supa.from('modelos').select('id, nome, largura, cor_1:cor_1_id(id, nome), cor_2:cor_2_id(id, nome)').order('nome'),
        window.supa.from('cores').select('id, nome').order('nome')
      ]);
      if (modelosRes.error || coresRes.error) { window.toast('Erro ao carregar', 'error'); console.error(modelosRes.error || coresRes.error); return; }
      render(modelosRes.data || [], coresRes.data || []);
    }

    function render(modelos, cores) {
      container.replaceChildren(
        window.pageHeader('Modelos', [{ label: '+ Novo modelo', onclick: () => openModal(null, cores) }]),
        window.dataTable({
          columns: [
            { key: 'id', label: 'ID' },
            { key: 'nome', label: 'Nome' },
            { key: 'cor_1', label: 'Cor 1 (predominante)', render: (r) => r.cor_1?.nome || '' },
            { key: 'cor_2', label: 'Cor 2', render: (r) => r.cor_2?.nome || '' },
            { key: 'largura', label: 'Largura', render: (r) => Number(r.largura).toFixed(2).replace('.', ',') + ' m' },
          ],
          rows: modelos,
          actions: [
            { label: 'Editar', onclick: (r) => openModal(r, cores) },
            { label: 'Excluir', class: 'text-red-600 hover:underline', onclick: (r) => confirmExcluir(r) },
          ]
        })
      );
    }

    function openModal(modelo, cores) {
      const isEdit = !!modelo;
      const corOptions = cores.map(c => ({ value: c.id, label: c.nome }));
      const nomeInput = window.textInput({ value: modelo?.nome || '', placeholder: 'Ex: Conforto', required: true });
      const cor1Sel = window.selectInput({ options: corOptions, value: modelo?.cor_1?.id });
      const cor2Sel = window.selectInput({ options: corOptions, value: modelo?.cor_2?.id });
      const largSel = window.selectInput({
        options: [{ value: '1.40', label: '1,40 m' }, { value: '2.10', label: '2,10 m' }],
        value: modelo?.largura
      });
      const body = window.el('div', {},
        window.formField({ label: 'Nome do modelo', input: nomeInput }),
        window.formField({ label: 'Cor 1 (predominante)', input: cor1Sel, hint: 'A ordem importa: "BRANCO/PRETO" é diferente de "PRETO/BRANCO".' }),
        window.formField({ label: 'Cor 2', input: cor2Sel }),
        window.formField({ label: 'Largura', input: largSel })
      );
      window.modal({
        title: isEdit ? 'Editar modelo' : 'Novo modelo',
        body,
        onSave: async () => {
          const nome = nomeInput.value.trim();
          const cor_1_id = cor1Sel.value;
          const cor_2_id = cor2Sel.value;
          const largura = largSel.value;
          if (!nome || !cor_1_id || !cor_2_id || !largura) { window.toast('Preencha todos os campos', 'error'); return false; }
          const payload = { nome, cor_1_id, cor_2_id, largura };
          const { error } = isEdit
            ? await window.supa.from('modelos').update(payload).eq('id', modelo.id)
            : await window.supa.from('modelos').insert(payload);
          if (error) { window.toast(error.message.includes('duplicate') ? 'Modelo já cadastrado com essa combinação' : 'Erro ao salvar', 'error'); console.error(error); return false; }
          window.toast(isEdit ? 'Modelo atualizado' : 'Modelo criado', 'success');
          reload();
        }
      });
    }

    function confirmExcluir(modelo) {
      window.confirmDialog({
        title: 'Excluir modelo',
        message: `Excluir "${modelo.nome}"? Se algum item de OP usar esse modelo, a exclusão vai falhar.`,
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          const { error } = await window.supa.from('modelos').delete().eq('id', modelo.id);
          if (error) { window.toast('Modelo está em uso (não dá pra excluir)', 'error'); console.error(error); return; }
          window.toast('Modelo excluído', 'success');
          reload();
        }
      });
    }

    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  async function screenCadastrosParametros() {
    const container = window.el('div', {});

    async function reload() {
      const { data, error } = await window.supa.from('parametros_largura').select('*').order('largura');
      if (error) { window.toast('Erro ao carregar parâmetros', 'error'); console.error(error); return; }
      render(data || []);
    }

    function render(rows) {
      const cards = window.el('div', { class: 'grid md:grid-cols-2 gap-4' });
      for (const p of rows) cards.appendChild(cardParametro(p));
      container.replaceChildren(
        window.pageHeader('Parâmetros de cálculo', []),
        window.el('p', { class: 'text-gray-600 mb-4 text-sm' }, 'Esses valores são usados no cálculo de fios ao simular uma OP. Edite com cuidado.'),
        cards
      );
    }

    function cardParametro(p) {
      const card = window.el('div', { class: 'bg-white rounded-xl shadow p-6' });
      card.appendChild(window.el('h2', { class: 'text-lg font-semibold mb-4' }, `Largura ${Number(p.largura).toFixed(2).replace('.', ',')} m`));
      const pesoInput  = window.textInput({ type: 'number', step: '0.0001', value: p.peso_linear });
      const algoInput  = window.textInput({ type: 'number', step: '0.000001', value: p.algodao_por_ml });
      const poliInput  = window.textInput({ type: 'number', step: '0.000001', value: p.poliester_por_ml });
      const valxInput  = window.textInput({ type: 'number', step: '0.0001', value: p.valor_x });
      card.appendChild(window.formField({ label: 'Peso linear', input: pesoInput }));
      card.appendChild(window.formField({ label: 'Algodão / ML', input: algoInput }));
      card.appendChild(window.formField({ label: 'Poliéster / ML', input: poliInput }));
      card.appendChild(window.formField({ label: 'Valor X', input: valxInput }));
      const btn = window.el('button', {
        class: 'mt-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4 py-2 rounded-lg',
        onclick: async () => {
          btn.disabled = true; btn.textContent = 'Salvando...';
          const payload = {
            peso_linear: pesoInput.value,
            algodao_por_ml: algoInput.value,
            poliester_por_ml: poliInput.value,
            valor_x: valxInput.value,
            atualizado_em: new Date().toISOString()
          };
          const { error } = await window.supa.from('parametros_largura').update(payload).eq('largura', p.largura);
          btn.disabled = false; btn.textContent = 'Salvar';
          if (error) { window.toast('Erro ao salvar', 'error'); console.error(error); return; }
          window.toast(`Parâmetros de ${p.largura}m atualizados`, 'success');
        }
      }, 'Salvar');
      card.appendChild(btn);
      return card;
    }

    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  async function screenCadastrosFornecedores() {
    const container = window.el('div', {});

    async function reload() {
      const { data, error } = await window.supa.from('fornecedores').select('*').order('tipo').order('nome');
      if (error) { window.toast('Erro ao carregar fornecedores', 'error'); console.error(error); return; }
      render(data || []);
    }

    function render(rows) {
      container.replaceChildren(
        window.pageHeader('Fornecedores', [{ label: '+ Novo fornecedor', onclick: () => openModal(null) }]),
        window.dataTable({
          columns: [
            { key: 'id', label: 'ID' },
            { key: 'nome', label: 'Nome' },
            { key: 'tipo', label: 'Tipo', render: (r) => labelFornecedorTipo(r.tipo) },
          ],
          rows,
          actions: [
            { label: 'Editar', onclick: (r) => openModal(r) },
            { label: 'Excluir', class: 'text-red-600 hover:underline', onclick: (r) => confirmExcluir(r) },
          ]
        })
      );
    }

    function openModal(forn) {
      const isEdit = !!forn;
      const nomeInput = window.textInput({ value: forn?.nome || '', placeholder: 'Ex: Tecelagem Fulano', required: true });
      const tipoSel = window.selectInput({ options: FORNECEDOR_TIPOS, value: forn?.tipo });
      const body = window.el('div', {},
        window.formField({ label: 'Nome', input: nomeInput }),
        window.formField({ label: 'Tipo', input: tipoSel })
      );
      window.modal({
        title: isEdit ? 'Editar fornecedor' : 'Novo fornecedor',
        body,
        onSave: async () => {
          const nome = nomeInput.value.trim();
          const tipo = tipoSel.value;
          if (!nome || !tipo) { window.toast('Preencha nome e tipo', 'error'); return false; }
          const payload = { nome, tipo };
          const { error } = isEdit
            ? await window.supa.from('fornecedores').update(payload).eq('id', forn.id)
            : await window.supa.from('fornecedores').insert(payload);
          if (error) { window.toast(error.message.includes('duplicate') ? 'Fornecedor com esse nome e tipo já existe' : 'Erro ao salvar', 'error'); console.error(error); return false; }
          window.toast(isEdit ? 'Fornecedor atualizado' : 'Fornecedor criado', 'success');
          reload();
        }
      });
    }

    function confirmExcluir(forn) {
      window.confirmDialog({
        title: 'Excluir fornecedor',
        message: `Excluir "${forn.nome}"? Se ele estiver vinculado a alguma OP, a exclusão vai falhar.`,
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          const { error } = await window.supa.from('fornecedores').delete().eq('id', forn.id);
          if (error) { window.toast('Fornecedor em uso (não dá pra excluir)', 'error'); console.error(error); return; }
          window.toast('Fornecedor excluído', 'success');
          reload();
        }
      });
    }

    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  async function screenCadastrosPrecos() {
    const container = window.el('div', {});

    async function reload() {
      const [precosRes, fornsRes] = await Promise.all([
        window.supa.from('precos_terceirizada').select('id, etapa, largura, preco_por_metro, fornecedor:fornecedor_id(id, nome, tipo)').order('etapa').order('largura'),
        window.supa.from('fornecedores').select('id, nome, tipo').in('tipo', ['tecelagem', 'latex']).order('nome')
      ]);
      if (precosRes.error || fornsRes.error) { window.toast('Erro ao carregar', 'error'); console.error(precosRes.error || fornsRes.error); return; }
      render(precosRes.data || [], fornsRes.data || []);
    }

    function render(precos, forns) {
      container.replaceChildren(
        window.pageHeader('Preços de terceirizadas', [{ label: '+ Novo preço', onclick: () => openModal(null, forns) }]),
        window.el('p', { class: 'text-gray-600 mb-4 text-sm' }, 'Preço cobrado por metro produzido, por etapa (parte de cima ou látex) e largura.'),
        window.dataTable({
          columns: [
            { key: 'fornecedor', label: 'Fornecedor', render: (r) => r.fornecedor?.nome || '' },
            { key: 'etapa', label: 'Etapa', render: (r) => r.etapa === 'cima' ? 'Parte de cima' : 'Látex' },
            { key: 'largura', label: 'Largura', render: (r) => Number(r.largura).toFixed(2).replace('.', ',') + ' m' },
            { key: 'preco_por_metro', label: 'R$ / metro', render: (r) => 'R$ ' + Number(r.preco_por_metro).toFixed(2).replace('.', ',') },
          ],
          rows: precos,
          actions: [
            { label: 'Editar', onclick: (r) => openModal(r, forns) },
            { label: 'Excluir', class: 'text-red-600 hover:underline', onclick: (r) => confirmExcluir(r) },
          ]
        })
      );
    }

    function openModal(preco, forns) {
      const isEdit = !!preco;
      const fornOptions = forns.map(f => ({ value: f.id, label: `${f.nome} (${f.tipo === 'tecelagem' ? 'tecelagem' : 'látex'})` }));
      const etapaOptions = [{ value: 'cima', label: 'Parte de cima' }, { value: 'latex', label: 'Látex' }];
      const largOptions = [{ value: '1.40', label: '1,40 m' }, { value: '2.10', label: '2,10 m' }];

      const fornSel = window.selectInput({ options: fornOptions, value: preco?.fornecedor?.id });
      const etapaSel = window.selectInput({ options: etapaOptions, value: preco?.etapa });
      const largSel = window.selectInput({ options: largOptions, value: preco?.largura });
      const precoInput = window.textInput({ type: 'number', step: '0.01', value: preco?.preco_por_metro || '', placeholder: '0,00' });

      const body = window.el('div', {},
        window.formField({ label: 'Fornecedor', input: fornSel }),
        window.formField({ label: 'Etapa', input: etapaSel }),
        window.formField({ label: 'Largura', input: largSel }),
        window.formField({ label: 'Preço por metro (R$)', input: precoInput })
      );

      window.modal({
        title: isEdit ? 'Editar preço' : 'Novo preço',
        body,
        onSave: async () => {
          const fornecedor_id = fornSel.value;
          const etapa = etapaSel.value;
          const largura = largSel.value;
          const preco_por_metro = parseFloat(precoInput.value);
          if (!fornecedor_id || !etapa || !largura || isNaN(preco_por_metro) || preco_por_metro < 0) {
            window.toast('Preencha todos os campos com valores válidos', 'error'); return false;
          }
          const payload = { fornecedor_id, etapa, largura, preco_por_metro, atualizado_em: new Date().toISOString() };
          const { error } = isEdit
            ? await window.supa.from('precos_terceirizada').update(payload).eq('id', preco.id)
            : await window.supa.from('precos_terceirizada').insert(payload);
          if (error) { window.toast(error.message.includes('duplicate') ? 'Já existe preço pra esse fornecedor + etapa + largura' : 'Erro ao salvar', 'error'); console.error(error); return false; }
          window.toast(isEdit ? 'Preço atualizado' : 'Preço criado', 'success');
          reload();
        }
      });
    }

    function confirmExcluir(preco) {
      window.confirmDialog({
        title: 'Excluir preço',
        message: `Excluir esse preço (${preco.fornecedor?.nome}, ${preco.etapa}, ${preco.largura}m)?`,
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          const { error } = await window.supa.from('precos_terceirizada').delete().eq('id', preco.id);
          if (error) { window.toast('Erro ao excluir', 'error'); console.error(error); return; }
          window.toast('Preço excluído', 'success');
          reload();
        }
      });
    }

    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  async function screenCadastrosUsuarios() {
    const container = window.el('div', {});

    async function reload() {
      const [usersRes, fornsRes] = await Promise.all([
        window.supa.from('usuarios').select('id, email, nome, tipo, fornecedor:fornecedor_id(id, nome, tipo)').order('email'),
        window.supa.from('fornecedores').select('id, nome, tipo').order('nome')
      ]);
      if (usersRes.error || fornsRes.error) { window.toast('Erro ao carregar', 'error'); console.error(usersRes.error || fornsRes.error); return; }
      render(usersRes.data || [], fornsRes.data || []);
    }

    function render(users, forns) {
      container.replaceChildren(
        window.pageHeader('Usuários', [{ label: '+ Novo usuário', onclick: () => openModal(null, forns) }]),
        window.dataTable({
          columns: [
            { key: 'email', label: 'E-mail' },
            { key: 'nome', label: 'Nome' },
            { key: 'tipo', label: 'Tipo' },
            { key: 'fornecedor', label: 'Fornecedor', render: (r) => r.fornecedor?.nome || '—' },
          ],
          rows: users,
          actions: [
            { label: 'Editar', onclick: (r) => openModal(r, forns) },
            { label: 'Em breve', class: 'text-gray-400 cursor-not-allowed', onclick: () => showDeleteBlocked() },
          ]
        })
      );
    }

    function openModal(usr, forns) {
      const isEdit = !!usr;
      const fornOptions = forns.map(f => ({ value: f.id, label: `${f.nome} (${labelFornecedorTipo(f.tipo)})` }));
      const tipoOptions = [{ value: 'admin', label: 'Admin' }, { value: 'fornecedor', label: 'Fornecedor' }];

      const emailInput = window.textInput({ type: 'email', value: usr?.email || '', placeholder: 'usuario@exemplo.com' });
      const nomeInput = window.textInput({ value: usr?.nome || '', placeholder: 'Ex: Fornecedor X' });
      const tipoSel = window.selectInput({ options: tipoOptions, value: usr?.tipo });
      const fornSel = window.selectInput({ options: fornOptions, value: usr?.fornecedor?.id, placeholder: '(nenhum)' });

      const fields = [];

      if (isEdit) {
        const idInput = window.textInput({ value: usr?.id || '', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' });
        idInput.disabled = true;
        idInput.classList.add('bg-gray-100');
        fields.push(window.formField({ label: 'UID do Auth', input: idInput, hint: 'Não pode ser alterado' }));
      }

      fields.push(window.formField({
        label: 'E-mail',
        input: emailInput,
        hint: isEdit ? '' : 'Será usado para login no Supabase Auth',
      }));
      fields.push(window.formField({ label: 'Nome', input: nomeInput }));
      fields.push(window.formField({ label: 'Tipo', input: tipoSel }));
      fields.push(window.formField({
        label: 'Fornecedor (se tipo for "fornecedor")',
        input: fornSel,
        hint: 'Deixe vazio se for admin',
      }));

      let passwordInput = null;
      if (!isEdit) {
        passwordInput = window.textInput({ type: 'password', value: '', placeholder: 'Mínimo 6 caracteres' });
        fields.push(window.formField({
          label: 'Senha temporária',
          input: passwordInput,
          hint: 'Defina uma senha inicial e oriente a troca depois.',
        }));
      }

      const body = window.el('div', {}, ...fields);

      window.modal({
        title: isEdit ? 'Editar usuário' : 'Novo usuário',
        body,
        onSave: async () => {
          const email = emailInput.value.trim();
          const nome = nomeInput.value.trim();
          const tipo = tipoSel.value;
          const fornecedor_id_raw = fornSel.value || null;

          if (!email || !nome || !tipo) {
            window.toast('Preencha e-mail, nome e tipo', 'error');
            return false;
          }
          if (tipo === 'fornecedor' && !fornecedor_id_raw) {
            window.toast('Usuário tipo "fornecedor" precisa de fornecedor vinculado', 'error');
            return false;
          }
          if (tipo === 'admin' && fornecedor_id_raw) {
            window.toast('Usuário admin não pode ter fornecedor vinculado', 'error');
            return false;
          }

          if (isEdit) {
            const { error } = await window.supa
              .from('usuarios')
              .update({ email, nome, tipo, fornecedor_id: fornecedor_id_raw })
              .eq('id', usr.id);
            if (error) {
              let msg = 'Erro ao salvar';
              if (error.message && error.message.includes('duplicate')) msg = 'E-mail já cadastrado';
              window.toast(msg, 'error');
              console.error(error);
              return false;
            }
            window.toast('Usuário atualizado', 'success');
            reload();
            return;
          }

          // Criação via Edge Function admin-create-user
          const password = passwordInput ? passwordInput.value : '';
          if (!password || password.length < 6) {
            window.toast('Senha temporária deve ter no mínimo 6 caracteres', 'error');
            return false;
          }
          const fornecedor_id = fornecedor_id_raw ? Number(fornecedor_id_raw) : null;

          const { error } = await window.supa.functions.invoke('admin-create-user', {
            body: { email, password, nome, tipo, fornecedor_id },
          });

          if (error) {
            let code = null;
            let msg = (error && error.message) ? error.message : 'Erro ao criar usuário';
            try {
              if (error && error.context && typeof error.context.json === 'function') {
                const body = await error.context.json();
                if (body && body.error) {
                  code = body.error.code || null;
                  if (body.error.message) msg = body.error.message;
                }
              }
            } catch (_) { /* ignore body parse errors */ }
            if (code === 'CONFLICT') msg = 'E-mail já cadastrado.';
            else if (code === 'FORBIDDEN') msg = 'Apenas admins podem criar usuários.';
            else if (code === 'UNAUTHORIZED') msg = 'Sessão expirada. Faça login novamente.';
            window.toast(msg, 'error');
            console.error('admin-create-user error', code, error);
            return false;
          }

          window.toast('Usuário criado', 'success');
          reload();
        },
      });
    }

    function showDeleteBlocked() {
      window.toast('Exclusão/desativação de usuários está temporariamente bloqueada. Use o Supabase Auth Dashboard para limpeza de testes em staging até a implementação do fluxo seguro.', 'info');
    }

    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};

  window.RAVATEX_SCREENS.cadastros = {
    FORNECEDOR_TIPOS,
    labelFornecedorTipo,
    screenCadastrosCores,
    screenCadastrosClientes,
    screenCadastrosModelos,
    screenCadastrosParametros,
    screenCadastrosFornecedores,
    screenCadastrosPrecos,
    screenCadastrosUsuarios,
  };

  // Compatibilidade com o setRoutes do inline e com call-sites bare
  // (e.g. selectInput({ options: FORNECEDOR_TIPOS, ... }) em
  // screenCadastrosFornecedores).
  window.FORNECEDOR_TIPOS = FORNECEDOR_TIPOS;
  window.labelFornecedorTipo = labelFornecedorTipo;

  window.screenCadastrosCores = screenCadastrosCores;
  window.screenCadastrosClientes = screenCadastrosClientes;
  window.screenCadastrosModelos = screenCadastrosModelos;
  window.screenCadastrosParametros = screenCadastrosParametros;
  window.screenCadastrosFornecedores = screenCadastrosFornecedores;
  window.screenCadastrosPrecos = screenCadastrosPrecos;
  window.screenCadastrosUsuarios = screenCadastrosUsuarios;
})(window);
