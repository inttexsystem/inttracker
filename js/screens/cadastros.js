// =====================================================================
// === SCREENS: CADASTROS (Seam A) ======================================
// Telas de cadastros administrativos (cores, clientes, modelos,
// parametros, fornecedores, precos, usuarios) + constantes diretamente
// relacionadas (FORNECEDOR_TIPOS, labelFornecedorTipo). Extraidas do
// <script> inline de index.html sem alterar comportamento, tabelas
// Supabase, CRUD ou regras de negocio.
//
// A tela #/cadastros/usuarios integra a Edge Function
// `admin-disable-user` (fase RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A):
//   - botão "Desativar" substitui o placeholder "Em breve";
//   - chama a Edge Function de desativação via functions.invoke,
//     enviando user_id e reason no body;
//   - mapeia códigos de erro (FORBIDDEN, SELF_DISABLE_FORBIDDEN,
//     LAST_ADMIN_FORBIDDEN, NOT_FOUND, AUTH_BAN_FAILED,
//     COMPENSATION_FAILED, etc.) para mensagens PT-BR;
//   - guarda de UX para o próprio usuário logado e usuários já
//     inativos (proteção visual, não substitui a checagem
//     server-side);
//   - nunca usa .delete() em public.usuarios, nunca expõe a chave
//     de privilégio admin nem usa APIs de admin no front.
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

  // Mapeia códigos de erro da Edge Function `admin-disable-user` para
  // mensagens amigáveis em PT-BR usadas pelo toast da UI. Mantém
  // fallback para a mensagem original ou um genérico.
  function friendlyDisableMessage(code, fallback) {
    switch (code) {
      case 'FORBIDDEN':
        return 'Usuário atual não tem permissão para desativar usuários.';
      case 'SELF_DISABLE_FORBIDDEN':
        return 'Você não pode desativar seu próprio usuário.';
      case 'LAST_ADMIN_FORBIDDEN':
        return 'Não é possível desativar o último admin ativo.';
      case 'NOT_FOUND':
        return 'Usuário não encontrado.';
      case 'AUTH_BAN_FAILED':
        return 'Falha operacional ao banir o usuário. O perfil foi revertido.';
      case 'COMPENSATION_FAILED':
        return 'Falha operacional grave. A reversão do perfil também falhou — reporte ao suporte.';
      case 'VALIDATION_ERROR':
        return 'Dados inválidos para desativação.';
      case 'UNAUTHORIZED':
        return 'Sessão expirada. Faça login novamente.';
      default:
        return fallback || 'Erro ao desativar usuário';
    }
  }

  // Mapeia códigos de erro da Edge Function `admin-delete-user`
  // (hard delete) para mensagens amigáveis em PT-BR. Mantém fallback
  // para a mensagem original ou um genérico.
  function friendlyDeleteMessage(code, fallback) {
    switch (code) {
      case 'FORBIDDEN':
        return 'Usuário atual não tem permissão para excluir usuários.';
      case 'SELF_DELETE_FORBIDDEN':
        return 'Você não pode excluir seu próprio usuário.';
      case 'LAST_ADMIN_FORBIDDEN':
        return 'Não é possível excluir o último admin ativo.';
      case 'NOT_FOUND':
        return 'Usuário não encontrado.';
      case 'CONFIRM_EMAIL_MISMATCH':
        return 'O e-mail digitado não confere com o e-mail do usuário.';
      case 'USER_HAS_REFERENCES':
        return 'Não foi possível remover o perfil: existem registros vinculados no banco. Remova os vínculos antes de excluir.';
      case 'AUTH_DELETE_FAILED':
        return 'Falha operacional ao remover do Auth. O perfil foi restaurado.';
      case 'COMPENSATION_FAILED':
        return 'Falha operacional grave. O perfil e o Auth estão inconsistentes — reporte ao suporte.';
      case 'VALIDATION_ERROR':
        return 'Dados inválidos para exclusão.';
      case 'UNAUTHORIZED':
        return 'Sessão expirada. Faça login novamente.';
      default:
        return fallback || 'Erro ao excluir usuário';
    }
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
    let lastRows = [];
    let saving = false;

    async function reload() {
      const { data, error } = await window.supa.from('parametros_largura').select('*').order('largura');
      if (error) { window.toast('Erro ao carregar par\u00e2metros', 'error'); console.error(error); return; }
      lastRows = (data || []).map((row) => ({ ...row }));
      render(lastRows);
    }

    function render(rows) {
      const orderedRows = [...rows].sort((a, b) => Number(a.largura) - Number(b.largura));
      const inputsByWidth = new Map();
      const latestMeta = getLatestMeta(orderedRows);

      const page = window.el('div', {
        style: 'display:flex; flex-direction:column;'
      });
      const headerBlock = window.el('div', {
        style: 'margin-bottom:22px;'
      });
      headerBlock.appendChild(window.el('div', {
        style: 'font-size:22px; font-weight:800; color:#16203a; letter-spacing:-.01em;'
      }, 'Par\u00e2metros de c\u00e1lculo'));
      headerBlock.appendChild(window.el('div', {
        style: 'font-size:13px; color:#8a93a3; margin-top:3px;'
      }, 'Esses valores s\u00e3o usados no c\u00e1lculo de fios ao simular uma OP. Edite com cuidado.'));
      page.appendChild(headerBlock);

      const card = window.el('section', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:6px; overflow:hidden;'
      });

      const cardHeader = window.el('div', {
        style: 'display:flex; align-items:flex-start; justify-content:space-between; gap:24px; padding:20px 24px 18px;'
      });
      const headerLeft = window.el('div', {
        style: 'display:flex; align-items:center; gap:14px; min-width:0;'
      });
      headerLeft.appendChild(window.el('div', {
        style: 'width:36px; height:36px; border-radius:6px; background:#eaf1fd; display:flex; align-items:center; justify-content:center; flex-shrink:0;'
      }, svgEl('<svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M9 21V9"></path></svg>', 18)));
      const headerText = window.el('div', {
        style: 'display:flex; flex-direction:column;'
      });
      headerText.appendChild(window.el('h2', {
        style: 'margin:0; font-size:15px; font-weight:700; color:#16203a;'
      }, 'Par\u00e2metros por largura'));
      headerText.appendChild(window.el('p', {
        style: 'margin:2px 0 0 0; font-size:12.5px; color:#8a93a3;'
      }, 'Valores em kg/ml, salvo indica\u00e7\u00e3o contr\u00e1ria.'));
      headerLeft.appendChild(headerText);

      const callout = window.el('div', {
        style: 'display:flex; align-items:flex-start; gap:8px; background:#f6f9ff; border:1px solid #d0e0fb; border-radius:4px; padding:10px 14px; max-width:340px; flex-shrink:0;'
      });
      callout.appendChild(svgEl('<svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>', 15));
      callout.appendChild(window.el('span', {
        style: 'font-size:12.5px; color:#2563eb; line-height:1.5;'
      }, 'Altera\u00e7\u00f5es afetam novas simula\u00e7\u00f5es de OP.', window.el('br'), 'OPs j\u00e1 abertas n\u00e3o s\u00e3o recalculadas automaticamente.'));
      cardHeader.appendChild(headerLeft);
      cardHeader.appendChild(callout);
      card.appendChild(cardHeader);

      const tableWrap = window.el('div', {
        style: 'border-top:1px solid #eceef1; overflow-x:auto;'
      });
      const grid = window.el('div', {});
      const headRow = window.el('div', {
        style: 'display:grid; grid-template-columns:1fr 1fr 1fr; gap:0; background:#f8f9fb; border-bottom:1px solid #eceef1;'
      });
      headRow.appendChild(headerCell('PAR\u00c2METRO', true));
      for (const row of orderedRows) headRow.appendChild(headerCell(`LARGURA ${formatWidth(row.largura)} m`, false));
      grid.appendChild(headRow);

      const fieldDefs = [
        { key: 'peso_linear', label: 'Peso linear', step: '0.0001' },
        { key: 'algodao_por_ml', label: 'Algod\u00e3o / ML', step: '0.000001' },
        { key: 'poliester_por_ml', label: 'Poli\u00e9ster / ML', step: '0.000001' },
        { key: 'valor_x', label: 'Fator X', step: '0.0001' },
      ];

      for (let index = 0; index < fieldDefs.length; index += 1) {
        const field = fieldDefs[index];
        const rowNode = window.el('div', {
          style: `display:grid; grid-template-columns:1fr 1fr 1fr; gap:0; align-items:center; border-bottom:${index === fieldDefs.length - 1 ? 'none' : '1px solid #f1f3f6'};`
        });
        rowNode.appendChild(paramLabelCell(field.label, index === fieldDefs.length - 1));
        for (const row of orderedRows) {
          const input = window.textInput({
            type: 'text',
            step: field.step,
            value: formatInputValue(row[field.key] ?? '')
          });
          styleInput(input);
          const widthKey = String(row.largura);
          if (!inputsByWidth.has(widthKey)) inputsByWidth.set(widthKey, {});
          inputsByWidth.get(widthKey)[field.key] = input;
          rowNode.appendChild(valueCell(input, index === fieldDefs.length - 1));
        }
        grid.appendChild(rowNode);
      }

      tableWrap.appendChild(grid);
      card.appendChild(tableWrap);

      const footer = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px 24px; border-top:1px solid #eceef1; margin-top:4px; flex-wrap:wrap;'
      });
      footer.appendChild(buildFooterMeta(latestMeta));

      const actions = window.el('div', {
        style: 'display:flex; gap:12px; align-items:center; justify-content:flex-end; flex-wrap:wrap;'
      });
      const cancelBtn = window.el('button', {
        type: 'button',
        style: 'display:inline-flex; align-items:center; gap:7px; background:#fff; color:#5b6472; border:1px solid #d8dce2; border-radius:4px; padding:9px 18px; font-weight:600; font-size:14px; font-family:inherit; cursor:pointer;',
        onclick: () => render(lastRows)
      }, 'Cancelar altera\u00e7\u00f5es');
      const saveBtn = window.el('button', {
        type: 'button',
        style: 'display:inline-flex; align-items:center; gap:8px; background:#2563eb; color:#fff; border:none; border-radius:4px; padding:9px 18px; font-weight:600; font-size:14px; font-family:inherit; cursor:pointer;',
        onclick: async () => {
          if (saving) return;
          saving = true;
          toggleActionButtons(cancelBtn, saveBtn, true);
          try {
            for (const row of orderedRows) {
              const widthKey = String(row.largura);
              const fieldInputs = inputsByWidth.get(widthKey) || {};
              const payload = {
                peso_linear: normalizeInputValue(fieldInputs.peso_linear?.value ?? row.peso_linear),
                algodao_por_ml: normalizeInputValue(fieldInputs.algodao_por_ml?.value ?? row.algodao_por_ml),
                poliester_por_ml: normalizeInputValue(fieldInputs.poliester_por_ml?.value ?? row.poliester_por_ml),
                valor_x: normalizeInputValue(fieldInputs.valor_x?.value ?? row.valor_x),
                atualizado_em: new Date().toISOString()
              };
              const { error } = await window.supa.from('parametros_largura').update(payload).eq('largura', row.largura);
              if (error) throw error;
            }
            window.toast('Par\u00e2metros atualizados', 'success');
            await reload();
          } catch (error) {
            window.toast('Erro ao salvar', 'error');
            console.error(error);
            toggleActionButtons(cancelBtn, saveBtn, false);
          } finally {
            saving = false;
          }
        }
      });
      saveBtn.appendChild(svgEl('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>', 15));
      saveBtn.appendChild(window.el('span', {}, 'Salvar par\u00e2metros'));
      actions.appendChild(cancelBtn);
      actions.appendChild(saveBtn);
      footer.appendChild(actions);
      card.appendChild(footer);

      page.appendChild(card);
      container.replaceChildren(page);
    }

    function svgEl(markup, size) {
      const wrap = window.el('span', {
        style: `width:${size}px; height:${size}px; display:inline-flex; align-items:center; justify-content:center; flex:0 0 auto;`
      });
      wrap.innerHTML = markup;
      const icon = wrap.firstChild;
      if (icon && icon.style) {
        icon.style.width = `${size}px`;
        icon.style.height = `${size}px`;
        icon.style.display = 'block';
      }
      return wrap;
    }

    function headerCell(text, isFirst) {
      return window.el('div', {
        style: [
          'padding:12px 24px',
          'text-align:left',
          'vertical-align:middle',
          `border-right:${isFirst ? '1px solid #eceef1' : 'none'}`,
          'font-size:11px',
          'font-weight:700',
          'color:#8a93a3',
          'letter-spacing:.04em'
        ].filter(Boolean).join('; ')
      }, text);
    }

    function paramLabelCell(label, isLastRow) {
      const td = window.el('div', {
        style: [
          'padding:16px 24px',
          'vertical-align:middle',
          'border-right:1px solid #eceef1'
        ].join('; ')
      });
      const wrap = window.el('div', {
        style: 'display:flex; align-items:center; font-size:14px; font-weight:500; color:#16203a;'
      });
      wrap.appendChild(window.el('span', {}, label));
      wrap.appendChild(window.el('span', {
        title: label,
        style: 'display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; border-radius:50%; border:1.5px solid #c5cad4; color:#9aa2af; font-size:10px; font-weight:700; cursor:help; flex-shrink:0; margin-left:6px;'
      }, '?'));
      td.appendChild(wrap);
      return td;
    }

    function valueCell(input, isLastRow) {
      const td = window.el('div', {
        style: [
          'padding:16px 24px',
          'vertical-align:middle'
        ].join('; ')
      });
      td.appendChild(input);
      return td;
    }

    function styleInput(input) {
      input.style.width = '100%';
      input.style.border = '1px solid #d8dce2';
      input.style.borderRadius = '4px';
      input.style.padding = '9px 12px';
      input.style.fontSize = '14px';
      input.style.fontFamily = 'inherit';
      input.style.color = '#16203a';
      input.style.border = '1px solid #d8dce2';
      input.style.background = '#fff';
      input.style.outline = 'none';
      input.style.boxSizing = 'border-box';
      input.addEventListener('focus', function () {
        input.style.borderColor = '#2563eb';
        input.style.boxShadow = '0 0 0 3px rgba(37,99,235,.1)';
      });
      input.addEventListener('blur', function () {
        input.style.borderColor = '#d8dce2';
        input.style.boxShadow = 'none';
      });
    }

    function buildFooterMeta(meta) {
      const wrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px;'
      });
      wrap.appendChild(svgEl('<svg viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>', 14));
      const text = window.el('div', {
        style: 'display:flex; flex-direction:column;'
      });
      text.appendChild(window.el('p', {
        style: 'margin:0; font-size:12.5px; color:#5b6472;'
      }, `\u00daltima atualiza\u00e7\u00e3o: ${meta.updatedAtLabel}`));
      text.appendChild(window.el('p', {
        style: 'margin:0; font-size:12px; color:#9aa2af;'
      }, `Atualizado por: ${meta.updatedByLabel}`));
      wrap.appendChild(text);
      return wrap;
    }

    function toggleActionButtons(cancelBtn, saveBtn, disabled) {
      cancelBtn.disabled = disabled;
      saveBtn.disabled = disabled;
      cancelBtn.style.opacity = disabled ? '0.65' : '1';
      saveBtn.style.opacity = disabled ? '0.75' : '1';
      cancelBtn.style.cursor = disabled ? 'default' : 'pointer';
      saveBtn.style.cursor = disabled ? 'default' : 'pointer';
      if (saveBtn.lastChild) saveBtn.lastChild.textContent = disabled ? 'Salvando...' : 'Salvar par\u00e2metros';
    }

    function getLatestMeta(rows) {
      const latestRow = rows.reduce((best, current) => {
        const bestTime = best?.atualizado_em ? Date.parse(best.atualizado_em) : 0;
        const currentTime = current?.atualizado_em ? Date.parse(current.atualizado_em) : 0;
        return currentTime > bestTime ? current : best;
      }, null);
      const updatedByLabel = latestRow?.atualizado_por_nome
        || latestRow?.atualizado_por
        || latestRow?.atualizado_por_email
        || '\u2014';
      return {
        updatedAtLabel: formatUpdatedAt(latestRow?.atualizado_em),
        updatedByLabel
      };
    }

    function formatUpdatedAt(value) {
      if (!value) return '\u2014';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '\u2014';
      const datePart = date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const timePart = date.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit'
      });
      return `${datePart} \u00e0s ${timePart}`;
    }

    function formatWidth(value) {
      return Number(value || 0).toFixed(2).replace('.', ',');
    }

    function formatInputValue(value) {
      if (value == null || value === '') return '';
      return String(value).replace('.', ',');
    }

    function normalizeInputValue(value) {
      return value == null ? value : String(value).replace(',', '.');
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
    let mostrarInativos = false;
    let allUsers = [];
    let allForns = [];
    let allClients = [];

    async function reload() {
      const [usersRes, fornsRes, clientsRes] = await Promise.all([
        window.supa
          .from('usuarios')
          .select('id, email, nome, tipo, ativo, desativado_em, fornecedor:fornecedor_id(id, nome, tipo), cliente:cliente_id(id, nome)')
          .order('email'),
        window.supa.from('fornecedores').select('id, nome, tipo').order('nome'),
        window.supa.from('clientes').select('id, nome').order('nome')
      ]);
      if (usersRes.error || fornsRes.error || clientsRes.error) { window.toast('Erro ao carregar', 'error'); console.error(usersRes.error || fornsRes.error || clientsRes.error); return; }
      allUsers = usersRes.data || [];
      allForns = fornsRes.data || [];
      allClients = clientsRes.data || [];
      render();
    }

    function render() {
      const meId = (window.CURRENT_USER && window.CURRENT_USER.id) || null;
      const visibleUsers = mostrarInativos
        ? allUsers
        : allUsers.filter((u) => u.ativo !== false);

      const toggle = window.el('label', { class: 'inline-flex items-center gap-2 text-sm text-gray-700 select-none cursor-pointer' },
        window.el('input', {
          type: 'checkbox',
          class: 'form-checkbox h-4 w-4 text-blue-600',
          onchange: (ev) => { mostrarInativos = !!ev.target.checked; render(); },
        }),
        'Mostrar inativos'
      );
      if (allUsers.some((u) => u.ativo === false)) toggle.classList.add('font-medium');

      const emptyMsg = window.el('p', { class: 'text-gray-500 italic' },
        mostrarInativos ? 'Nenhum usuário cadastrado.' : 'Nenhum usuário ativo encontrado.');

      const tableNode = visibleUsers.length === 0
        ? emptyMsg
        : window.dataTable({
            columns: [
              { key: 'email', label: 'E-mail' },
              { key: 'nome', label: 'Nome' },
              { key: 'tipo', label: 'Tipo' },
              { key: 'fornecedor', label: 'Fornecedor', render: (r) => r.fornecedor?.nome || '—' },
              { key: 'cliente', label: 'Cliente', render: (r) => r.cliente?.nome || '—' },
              { key: 'status', label: 'Status', render: (r) => r.ativo === false ? 'Inativo' : 'Ativo' },
            ],
            rows: visibleUsers,
            actions: [
              { label: 'Editar', onclick: (r) => openModal(r, allForns, allClients) },
              {
                label: (r) => (r && r.ativo === false) ? 'Inativo' : 'Desativar',
                class: 'text-red-600 hover:underline',
                onclick: (r) => handleDesativarClick(r, meId),
              },
              {
                label: (r) => (r && r.id === meId) ? '—' : 'Excluir',
                class: 'text-red-700 hover:underline font-semibold ml-3',
                onclick: (r) => handleExcluirClick(r, meId),
              },
            ],
          });

      container.replaceChildren(
        window.pageHeader('Usuários', [{ label: '+ Novo usuário', onclick: () => openModal(null, allForns, allClients) }]),
        window.el('div', { class: 'mb-3' }, toggle),
        tableNode
      );
    }

    function handleDesativarClick(r, meId) {
      // Guarda de UX (não substitui a checagem server-side).
      if (r.ativo === false) {
        window.toast('Usuário já está inativo.', 'info');
        return;
      }
      if (meId && r.id === meId) {
        window.toast('Você não pode desativar seu próprio usuário.', 'info');
        return;
      }
      confirmDesativar(r);
    }

    function confirmDesativar(usr) {
      const motivoInput = window.textInput({
        type: 'text',
        value: '',
        placeholder: 'Opcional — ex.: fornecedor descartável de teste',
      });
      const body = window.el('div', {},
        window.el('p', { class: 'text-sm text-gray-700 mb-3' },
          'Desativar "' + usr.email + '"? O perfil será marcado como inativo e o login no Auth será bloqueado. Esta ação pode ser revertida por outro admin.'),
        window.formField({
          label: 'Motivo (opcional)',
          input: motivoInput,
          hint: 'Será registrado em public.usuarios.motivo_desativacao (até 500 caracteres).',
        })
      );
      window.modal({
        title: 'Desativar usuário',
        body,
        saveLabel: 'Desativar',
        onSave: async () => {
          const reason = (motivoInput.value || '').trim().slice(0, 500);
          await desativarUsuario(usr, reason || 'Desativação via UI');
        },
      });
    }

    async function desativarUsuario(usr, reason) {
      const { error } = await window.supa.functions.invoke('admin-disable-user', {
        body: { user_id: usr.id, reason },
      });
      if (error) {
        let code = null;
        let msg = (error && error.message) ? error.message : 'Erro ao desativar usuário';
        try {
          if (error && error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            if (body && body.error) {
              code = body.error.code || null;
              if (body.error.message) msg = body.error.message;
            }
          }
        } catch (_) { /* ignore body parse errors */ }
        const friendly = friendlyDisableMessage(code, msg);
        window.toast(friendly, 'error');
        console.error('admin-disable-user error', code, error);
        return;
      }
      window.toast('Usuário desativado', 'success');
      reload();
    }

    // -----------------------------------------------------------------
    // Excluir (hard delete) — admin-delete-user
    // -----------------------------------------------------------------

    function handleExcluirClick(r, meId) {
      // Guarda de UX (não substitui a checagem server-side).
      if (meId && r.id === meId) {
        window.toast('Você não pode excluir seu próprio usuário.', 'info');
        return;
      }
      confirmExcluirUsuario(r);
    }

    function confirmExcluirUsuario(usr) {
      const emailInput = window.textInput({
        type: 'email',
        value: '',
        placeholder: usr.email,
      });
      const body = window.el('div', {},
        window.el('p', { class: 'text-sm text-red-700 font-semibold mb-2' },
          'Exclusão permanente. Esta ação não pode ser desfeita.'),
        window.el('p', { class: 'text-sm text-gray-700 mb-3' },
          'Para confirmar, digite o e-mail do usuário (' + usr.email + '). O perfil e a conta de Auth serão removidos.'),
        window.formField({
          label: 'Confirmar e-mail',
          input: emailInput,
          hint: 'Deve ser exatamente igual ao e-mail do usuário.',
        })
      );
      window.modal({
        title: 'Excluir usuário',
        body,
        saveLabel: 'Excluir permanentemente',
        onSave: async () => {
          const confirmEmail = (emailInput.value || '').trim();
          if (confirmEmail.toLowerCase() !== String(usr.email || '').toLowerCase()) {
            window.toast('O e-mail digitado não confere com o e-mail do usuário.', 'error');
            return;
          }
          await excluirUsuario(usr, confirmEmail);
        },
      });
    }

    async function excluirUsuario(usr, confirmEmail) {
      const { error } = await window.supa.functions.invoke('admin-delete-user', {
        body: { user_id: usr.id, confirm_email: confirmEmail },
      });
      if (error) {
        let code = null;
        let msg = (error && error.message) ? error.message : 'Erro ao excluir usuário';
        try {
          if (error && error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            if (body && body.error) {
              code = body.error.code || null;
              if (body.error.message) msg = body.error.message;
            }
          }
        } catch (_) { /* ignore body parse errors */ }
        const friendly = friendlyDeleteMessage(code, msg);
        window.toast(friendly, 'error');
        console.error('admin-delete-user error', code, error);
        return;
      }
      window.toast('Usuário excluído permanentemente.', 'success');
      reload();
    }

    function openModal(usr, forns, clients) {
      const isEdit = !!usr;
      const fornOptions = forns.map(f => ({ value: f.id, label: `${f.nome} (${labelFornecedorTipo(f.tipo)})` }));
      const tipoOptions = [{ value: 'admin', label: 'Admin' }, { value: 'fornecedor', label: 'Fornecedor' }, { value: 'cliente', label: 'Cliente' }];

      const emailInput = window.textInput({ type: 'email', value: usr?.email || '', placeholder: 'usuario@exemplo.com' });
      const nomeInput = window.textInput({ value: usr?.nome || '', placeholder: 'Ex: Fornecedor X' });
      const tipoSel = window.selectInput({ options: tipoOptions, value: usr?.tipo });
      const clienteOptions = clients.map(function(c) { return { value: c.id, label: c.nome }; });
      const fornSel = window.selectInput({ options: fornOptions, value: usr?.fornecedor?.id, placeholder: '(nenhum)' });
      const clienteSel = window.selectInput({ options: clienteOptions, value: usr?.cliente?.id, placeholder: '(nenhum)' });

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

      const wrapperForn = window.el('div', {}, window.formField({
        label: 'Fornecedor vinculado',
        input: fornSel,
        hint: 'Obrigatório se tipo = Fornecedor',
      }));
      const wrapperCli = window.el('div', {}, window.formField({
        label: 'Cliente vinculado',
        input: clienteSel,
        hint: 'Obrigatório se tipo = Cliente',
      }));
      fields.push(wrapperForn, wrapperCli);

      function updateVinculoVisibility() {
        var t = tipoSel.value;
        wrapperForn.style.display = (t === 'fornecedor') ? '' : 'none';
        wrapperCli.style.display = (t === 'cliente') ? '' : 'none';
      }
      tipoSel.addEventListener('change', updateVinculoVisibility);
      updateVinculoVisibility();

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
          const cliente_id_raw = clienteSel.value || null;

          if (!email || !nome || !tipo) {
            window.toast('Preencha e-mail, nome e tipo', 'error');
            return false;
          }
          if (tipo === 'fornecedor' && !fornecedor_id_raw) {
            window.toast('Usuário tipo "fornecedor" precisa de fornecedor vinculado', 'error');
            return false;
          }
          if (tipo === 'fornecedor' && cliente_id_raw) {
            window.toast('Usuário fornecedor não pode ter cliente vinculado', 'error');
            return false;
          }
          if (tipo === 'cliente' && !cliente_id_raw) {
            window.toast('Usuário tipo "cliente" precisa de cliente vinculado', 'error');
            return false;
          }
          if (tipo === 'cliente' && fornecedor_id_raw) {
            window.toast('Usuário cliente não pode ter fornecedor vinculado', 'error');
            return false;
          }
          if (tipo === 'admin' && fornecedor_id_raw) {
            window.toast('Usuário admin não pode ter fornecedor vinculado', 'error');
            return false;
          }
          if (tipo === 'admin' && cliente_id_raw) {
            window.toast('Usuário admin não pode ter cliente vinculado', 'error');
            return false;
          }

          if (isEdit) {
            const { error } = await window.supa
              .from('usuarios')
              .update({ email, nome, tipo, fornecedor_id: fornecedor_id_raw, cliente_id: cliente_id_raw })
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
          const cliente_id = cliente_id_raw ? Number(cliente_id_raw) : null;

          const { error } = await window.supa.functions.invoke('admin-create-user', {
            body: { email, password, nome, tipo, fornecedor_id, cliente_id },
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
